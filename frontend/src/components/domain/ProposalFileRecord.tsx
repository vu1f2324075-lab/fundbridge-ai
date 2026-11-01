/**
 * The stored-file record panel.
 *
 * Kept in its own module, apart from the viewer, because the viewer imports
 * pdf.js. Any page that wanted this panel would otherwise pull a 1.4MB PDF
 * engine into its bundle for the sake of a definition list.
 */
import { Card, CardHeader } from '../ui';
import { formatBytes, formatDate } from '../../utils/format';
import type { Proposal } from '../../types/modules';

/**
 * The stored record itself, as the database holds it.
 *
 * `storageKey` is deliberately absent: it never leaves the server, so no
 * response body carries a value that maps to a path on disk. What is shown is
 * what identifies the file to a reader — its name, type, size, and the SHA-256
 * of the bytes that were actually stored.
 */
export function ProposalFileRecord({ proposal }: { proposal: Proposal }) {
  const rows: Array<[string, string]> = [
    ['Original filename', proposal.originalName],
    ['Stored format', proposal.fileType.toUpperCase()],
    ['Size on disk', formatBytes(proposal.fileSize)],
    ['Uploaded', formatDate(proposal.createdAt)],
    [
      'Word count',
      proposal.wordCount === null ? 'Not extracted' : proposal.wordCount.toLocaleString(),
    ],
  ];

  return (
    <Card>
      <CardHeader title="Stored file record" description="What the database holds for this upload." />
      <dl className="divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-[13px] text-ink-soft">{label}</dt>
            <dd className="text-[13px] text-ink font-medium text-right break-all">{value}</dd>
          </div>
        ))}
        <div className="py-2">
          <dt className="text-[13px] text-ink-soft">File reference</dt>
          <dd className="text-[12px] text-ink font-mono mt-1 break-all">
            {proposal.downloadUrl}
          </dd>
          <p className="text-[12px] text-ink-soft mt-1">
            Authenticated and ownership-checked — it cannot be opened by pasting it into an address
            bar, only fetched by the signed-in owner.
          </p>
        </div>
        {proposal.checksum && (
          <div className="py-2">
            <dt className="text-[13px] text-ink-soft">SHA-256 of the stored bytes</dt>
            <dd className="text-[12px] text-ink font-mono mt-1 break-all">
              {proposal.checksum}
            </dd>
            <p className="text-[12px] text-ink-soft mt-1">
              Recorded on upload. It identifies a re-upload of the same file and would reveal
              storage corruption.
            </p>
          </div>
        )}
      </dl>
    </Card>
  );
}
