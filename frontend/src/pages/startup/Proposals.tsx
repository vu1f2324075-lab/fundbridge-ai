/**
 * Proposal list and upload.
 *
 * The upload pipeline can partially succeed — the file is stored, then extracted,
 * then analysed, and either later step can fail. The UI reflects that honestly:
 * a stored-but-unanalysed proposal is shown with its reason and a retry, never
 * silently discarded or reported as a failure.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  ScoreBar,
} from '../../components/ui';
import { IconDocument } from '../../components/ui/icons';
import { useMeta } from '../../hooks/queries';
import {
  useAnalyseProposal,
  useDeleteProposal,
  useExtractProposal,
  useProposals,
  useUploadProposal,
} from '../../hooks/moduleQueries';
import { ApiError, apiBlob, saveBlob } from '../../lib/api';
import { formatBytes, formatDate } from '../../utils/format';
import type { Proposal, ProposalStatus } from '../../types/modules';

const STATUS_TONE: Record<ProposalStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  UPLOADED: 'neutral',
  EXTRACTING: 'info',
  EXTRACTED: 'info',
  EXTRACTION_FAILED: 'danger',
  ANALYSING: 'info',
  ANALYSED: 'success',
  ANALYSIS_FAILED: 'danger',
};

const STATUS_LABEL: Record<ProposalStatus, string> = {
  UPLOADED: 'Uploaded',
  EXTRACTING: 'Reading document',
  EXTRACTED: 'Text extracted',
  EXTRACTION_FAILED: 'Could not read',
  ANALYSING: 'Analysing',
  ANALYSED: 'Analysed',
  ANALYSIS_FAILED: 'Analysis failed',
};

const MAX_BYTES = 10 * 1024 * 1024;

function UploadCard() {
  const upload = useUploadProposal();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: ProposalStatus; message: string | null } | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);

    // Checked client-side for a fast message; the server validates
    // independently on content, which is the real control.
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (ext !== '.pdf' && ext !== '.docx') {
      setError('Upload a PDF or Word (.docx) file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}.`);
      return;
    }

    try {
      const r = await upload.mutateAsync(file);
      setResult({ status: r.status, message: r.message });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The upload failed.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader
        title="Upload a proposal"
        description="PDF or Word (.docx), up to 10MB. The document is read, sectioned and analysed on upload."
      />

      <div className="border border-dashed border-line-strong rounded-lg p-6 text-center bg-canvas">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          id="proposal-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <label htmlFor="proposal-file" className="cursor-pointer">
          <span className="block text-[13px] font-medium text-ink">
            {upload.isPending ? 'Uploading and analysing…' : 'Choose a file'}
          </span>
          <span className="block text-[12px] text-ink-soft mt-1">
            Your proposal is private to your account and is never shared with other users.
          </span>
        </label>
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            Select document
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorPanel message={error} />
        </div>
      )}

      {result && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 border ${
            result.status === 'ANALYSED'
              ? 'bg-success-bg border-success/25'
              : 'bg-warning-bg border-warning/30'
          }`}
          role="status"
        >
          <p className="text-[13px] text-ink">
            {result.status === 'ANALYSED'
              ? 'Uploaded and analysed.'
              : `Uploaded, but processing did not complete: ${STATUS_LABEL[result.status]}.`}
          </p>
          {result.message && <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">{result.message}</p>}
        </div>
      )}
    </Card>
  );
}

function ProposalRow({ proposal }: { proposal: Proposal }) {
  const analyse = useAnalyseProposal();
  const extract = useExtractProposal();
  const remove = useDeleteProposal();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Fetched rather than linked: the API is a different origin and the session
  // cookie is SameSite-restricted, so a plain anchor would 401. See `apiBlob`.
  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, filename } = await apiBlob(proposal.downloadUrl.replace(/^\/api/, ''));
      saveBlob(blob, filename ?? proposal.originalName);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'The download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const analysis = proposal.analyses[0];
  const canAnalyse = proposal.status === 'EXTRACTED' || proposal.status === 'ANALYSIS_FAILED';
  const canExtract = proposal.status === 'EXTRACTION_FAILED' || proposal.status === 'UPLOADED';

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/app/proposals/${proposal.id}`}
              className="text-[14px] font-medium text-ink hover:text-accent transition-colors break-all"
            >
              {proposal.originalName}
            </Link>
            <Badge tone={STATUS_TONE[proposal.status]}>{STATUS_LABEL[proposal.status]}</Badge>
          </div>

          <p className="text-[12px] text-ink-soft mt-1">
            {proposal.fileType.toUpperCase()} · {formatBytes(proposal.fileSize)} ·{' '}
            {proposal.wordCount ? `${proposal.wordCount.toLocaleString('en-IN')} words · ` : ''}
            uploaded {formatDate(proposal.createdAt)}
          </p>

          {proposal.statusMessage && (
            <p className="text-[12px] text-warning mt-2 leading-relaxed">{proposal.statusMessage}</p>
          )}

          {downloadError && (
            <p className="text-[12px] text-danger mt-2 leading-relaxed">{downloadError}</p>
          )}

          {analysis && (
            <div className="mt-3 max-w-xs">
              <ScoreBar label="Overall proposal score" score={analysis.overallScore} />
              <p className="text-[11px] text-ink-faint mt-1.5">
                {analysis.llmAssisted ? 'Findings AI-assisted' : 'Findings computed deterministically'} ·{' '}
                {analysis.modelVersion}
              </p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-2">
          {/* Always available: the stored file exists even when analysis failed. */}
          <Link to={`/app/proposals/${proposal.id}`}>
            <Button variant="primary" size="sm" className="w-full">
              {analysis ? 'Open document & analysis' : 'Open document'}
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            loading={downloading}
            onClick={() => void handleDownload()}
          >
            Download
          </Button>
          {canExtract && (
            <Button
              size="sm"
              variant="secondary"
              loading={extract.isPending}
              onClick={() => extract.mutate(proposal.id)}
            >
              Retry reading
            </Button>
          )}
          {canAnalyse && (
            <Button
              size="sm"
              variant="secondary"
              loading={analyse.isPending}
              onClick={() => analyse.mutate(proposal.id)}
            >
              {proposal.status === 'ANALYSIS_FAILED' ? 'Retry analysis' : 'Analyse'}
            </Button>
          )}
          {confirmDelete ? (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="danger"
                loading={remove.isPending}
                onClick={() => remove.mutate(proposal.id)}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ProposalsPage() {
  const { data: meta } = useMeta();
  const { data, isLoading, isError, error, refetch } = useProposals();

  // The feature depends on the Python AI service for extraction and analysis.
  if (meta && meta.features['proposalUpload'] === false) {
    return (
      <div>
        <PageHeader title="Proposals" />
        <EmptyState
          icon={<IconDocument size={22} />}
          title="Proposal processing is unavailable"
          description="Uploading a proposal requires the document-processing service, which is not currently running. Nothing has been lost — try again once it is available."
        />
      </div>
    );
  }

  if (isLoading) return <LoadingPanel label="Loading your proposals…" />;
  if (isError) {
    return (
      <ErrorPanel
        message={error instanceof ApiError ? error.message : 'Could not load your proposals.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const proposals = data?.proposals ?? [];
  const analysedCount = proposals.filter((p) => p.status === 'ANALYSED').length;

  return (
    <div>
      <PageHeader
        title="Proposals"
        description="Upload your funding proposal to have it read, sectioned and assessed. The most recent analysed proposal feeds the Proposal Quality component of your readiness score."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <UploadCard />
        </div>

        <div className="lg:col-span-3 space-y-3">
          {proposals.length === 0 ? (
            <EmptyState
              icon={<IconDocument size={22} />}
              title="No proposals yet"
              description="Until a proposal has been analysed, Proposal Quality stays at zero in your readiness score and is reported as such rather than estimated."
            />
          ) : (
            <>
              <p className="text-[12px] text-ink-soft">
                {proposals.length} proposal{proposals.length > 1 ? 's' : ''}
                {analysedCount > 0 ? `, ${analysedCount} analysed` : ''}
              </p>
              {proposals.map((p) => (
                <ProposalRow key={p.id} proposal={p} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
