import type { Document } from '@exitforge/shared';

interface Props {
  caseId: string;
  documents: Document[];
}

const TYPE_LABELS: Record<string, string> = {
  TIMESHARE_CONTRACT: 'Timeshare Contract',
  DEED: 'Deed',
  MAINTENANCE_FEE_STATEMENT: 'Maintenance Fee Statement',
  DEMAND_LETTER: 'Demand Letter',
  RESORT_RESPONSE: 'Resort Response',
  CFPB_COMPLAINT: 'CFPB Complaint',
  AG_COMPLAINT: 'AG Complaint',
  ATTORNEY_CORRESPONDENCE: 'Attorney Correspondence',
};

export function DocumentVault({ documents }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Document Vault</h3>
        <span className="text-sm text-slate-500">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
      </div>

      {documents.length === 0 ? (
        <p className="text-slate-500 text-sm">
          Upload your timeshare contract to begin AI contract analysis.
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2.5 px-3 bg-slate-800/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📄</span>
                <div>
                  <p className="text-sm text-white">{TYPE_LABELS[doc.type] ?? doc.type}</p>
                  <p className="text-xs text-slate-500">
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={doc.ocrStatus} label="OCR" />
                <StatusPill status={doc.analysisStatus} label="Analysis" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const colors = {
    PENDING: 'bg-slate-700 text-slate-400',
    PROCESSING: 'bg-yellow-500/20 text-yellow-400',
    COMPLETE: 'bg-green-500/20 text-green-400',
    FAILED: 'bg-red-500/20 text-red-400',
  };
  const color = colors[status as keyof typeof colors] ?? colors.PENDING;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label}: {status}
    </span>
  );
}
