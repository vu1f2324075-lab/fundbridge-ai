/**
 * Stored-proposal file viewer and record panel.
 *
 * Two decisions here are security decisions, not styling ones.
 *
 * 1. **The bytes are fetched, not linked.** `GET /api/proposals/:id/download`
 *    is authenticated and ownership-checked, and the app runs on a different
 *    origin from the API with a `SameSite`-restricted session cookie. A
 *    browser-initiated load — `<iframe src>`, `<embed src>`, a `target="_blank"`
 *    link — would arrive with no cookie and 401. So `apiBlob` pulls the file
 *    with `credentials: 'include'` and the viewer renders from the buffer.
 *
 * 2. **PDF.js renders it, not the browser's built-in viewer.** The backend
 *    forces `Content-Disposition: attachment` precisely so an uploaded file can
 *    never be rendered inline by the browser — that is what turns a stored-file
 *    endpoint into a stored-XSS vector. Rendering to a `<canvas>` here keeps
 *    that intact: an uploaded PDF is parsed as data and painted as pixels, it
 *    is never given a browsing context of its own. `isEvalSupported: false`
 *    removes the remaining code path a malicious font table could reach.
 *
 * A `.docx` is not previewed at all. There is no in-browser renderer for one
 * worth adding here, so the panel says so plainly and offers the download
 * rather than showing a broken frame.
 */
import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button, Card, CardHeader, Spinner } from '../ui';
import { ApiError, apiBlob, saveBlob } from '../../lib/api';
import { formatBytes } from '../../utils/format';
import type { Proposal } from '../../types/modules';

// Bundled with the app rather than pulled from a CDN: the worker parses
// untrusted documents, so it must be the exact build that ships with the
// matching library version.
GlobalWorkerOptions.workerSrc = workerSrc;

/** Beyond this, rendering every page costs more than it is worth on screen. */
const MAX_PREVIEW_PAGES = 25;

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2] as const;

/** Strips the `/api` prefix, which `apiBlob` adds back from its own base URL. */
function toApiPath(downloadUrl: string): string {
  return downloadUrl.replace(/^\/api/, '');
}

/**
 * Renders one page into its own canvas.
 *
 * A render task is cancellable and must be cancelled on unmount and on a zoom
 * change, otherwise two tasks race for the same canvas and pdf.js throws.
 */
function PdfPage({
  doc,
  pageNumber,
  containerWidth,
  zoom,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth <= 0) return;

    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        // Fit to the measured container, then apply the reader's zoom on top.
        const unscaled = page.getViewport({ scale: 1 });
        const fit = (containerWidth / unscaled.width) * zoom;

        // Painted at device resolution and scaled back down with CSS, so text
        // is sharp on a high-DPI screen instead of upscaled and blurry.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: fit * dpr });

        const context = canvas.getContext('2d');
        if (!context) {
          setFailed(true);
          return;
        }

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        task = page.render({ canvasContext: context, viewport });
        await task.promise;
      } catch (err) {
        // A cancelled render is the expected outcome of unmounting or zooming,
        // not a failure worth showing.
        const name = (err as { name?: string } | null)?.name;
        if (!cancelled && name !== 'RenderingCancelledException') setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, containerWidth, zoom]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="block mx-auto bg-white shadow-[0_1px_3px_rgba(23,32,51,0.12)] rounded-sm"
        role="img"
        aria-label={`Page ${pageNumber}`}
      />
      {failed && (
        <p className="text-[13px] text-danger text-center py-6">
          Page {pageNumber} could not be rendered.
        </p>
      )}
      <p className="text-[11px] text-ink-soft text-center mt-2 mb-4">Page {pageNumber}</p>
    </div>
  );
}

/** The stored document, rendered in place. */
export function ProposalFileViewer({ proposal }: { proposal: Proposal }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [containerWidth, setContainerWidth] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Measured rather than assumed, so a page fits the column it is actually in
  // and keeps fitting when the window is resized.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setContainerWidth(width - 24);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (proposal.fileType !== 'pdf') {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;

    void (async () => {
      setStatus('loading');
      setError(null);
      try {
        const { blob } = await apiBlob(toApiPath(proposal.downloadUrl));
        if (cancelled) return;

        const buffer = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;

        loaded = await getDocument({
          data: buffer,
          // Closes the one path by which a crafted document could get code to
          // run; pdf.js uses eval only to speed up font parsing.
          isEvalSupported: false,
        }).promise;

        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setDoc(loaded);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'The document could not be opened. It may not be a readable PDF.',
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      // Frees the worker and the parsed document. Without this, moving between
      // proposals leaks one worker per visit.
      if (loaded) void loaded.destroy();
      setDoc(null);
    };
  }, [proposal.id, proposal.fileType, proposal.downloadUrl]);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await apiBlob(toApiPath(proposal.downloadUrl));
      saveBlob(blob, filename ?? proposal.originalName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const pageCount = doc?.numPages ?? 0;
  const shown = Math.min(pageCount, MAX_PREVIEW_PAGES);
  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;

  return (
    <Card padded={false}>
      <div className="p-5 pb-0">
        <CardHeader
          title="The document"
          description={
            status === 'ready'
              ? `${proposal.originalName} — ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}, ${formatBytes(proposal.fileSize)}`
              : `${proposal.originalName} — ${formatBytes(proposal.fileSize)}`
          }
          action={
            <div className="flex items-center gap-2">
              {status === 'ready' && (
                <div className="flex items-center gap-1 mr-1" role="group" aria-label="Zoom">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={zoomIndex === 0}
                    onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                  >
                    <span aria-hidden="true">&minus;</span>
                    <span className="sr-only">Zoom out</span>
                  </Button>
                  <span className="text-[12px] text-ink-soft tabular-nums w-10 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={zoomIndex === ZOOM_STEPS.length - 1}
                    onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                  >
                    <span aria-hidden="true">+</span>
                    <span className="sr-only">Zoom in</span>
                  </Button>
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                loading={downloading}
                onClick={() => void handleDownload()}
              >
                Download
              </Button>
            </div>
          }
        />
      </div>

      {error && status !== 'error' && <p className="px-5 pb-3 text-[13px] text-danger">{error}</p>}

      <div
        ref={containerRef}
        className="bg-canvas border-t border-line px-3 py-4 max-h-[720px] overflow-y-auto rounded-b-[10px]"
      >
        {status === 'loading' && (
          <div className="py-12 flex justify-center">
            <Spinner label="Opening the document…" />
          </div>
        )}

        {status === 'unsupported' && (
          <div className="py-10 px-4 text-center">
            <p className="text-[13px] text-ink font-medium">
              Word documents cannot be previewed here
            </p>
            <p className="text-[13px] text-ink-soft mt-1 max-w-sm mx-auto">
              The file is stored and has been analysed — the scores and findings below come from it.
              Download it to read the original.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-10 px-4 text-center">
            <p className="text-[13px] text-danger font-medium">{error}</p>
            <p className="text-[13px] text-ink-soft mt-1">
              The stored file is still available to download.
            </p>
          </div>
        )}

        {status === 'ready' && doc && (
          <>
            {Array.from({ length: shown }, (_, i) => (
              <PdfPage
                key={i + 1}
                doc={doc}
                pageNumber={i + 1}
                containerWidth={containerWidth}
                zoom={zoom}
              />
            ))}
            {pageCount > shown && (
              <p className="text-[13px] text-ink-soft text-center py-4 border-t border-line">
                Showing the first {shown} of {pageCount} pages. Download the file to read the rest.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
