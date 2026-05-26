import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface Props {
  params: { id: string };
}

/**
 * Per-case evidence pack view.
 * Shows all pack versions for a case, strength scores, and delivery history.
 * Generate button triggers the evidence-pack-service API.
 */
export default async function CaseEvidencePackPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const caseId = params.id;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Evidence Pack</h1>
            <p className="text-slate-500 text-sm mt-1">
              Case{' '}
              <span className="font-mono text-indigo-400">{caseId}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`/cases/${caseId}`}
              className="px-4 py-2 rounded-lg text-sm border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
            >
              ← Case Detail
            </a>
            {/* 
              Generate button — in production, this calls:
              POST /evidence-packs/generate  { case_id, delivery_method: 'PORTAL' }
              via a server action or API route
            */}
            <button className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
              Generate New Pack
            </button>
          </div>
        </div>

        {/* What gets assembled */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            What&apos;s In an Evidence Pack
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { num: '1', title: 'Executive Summary', sub: '5-min attorney go/no-go' },
              { num: '2', title: 'Client Declaration', sub: 'Sworn statement for filing' },
              { num: '3', title: 'Contract Analysis', sub: 'Annotated illegal clauses' },
              { num: '4', title: 'Misrepresentation Matrix', sub: 'Per-claim evidence table' },
              { num: '5', title: 'Applicable Law Brief', sub: 'State + federal statutes' },
              { num: '6', title: 'Financial Impact', sub: 'Lifetime damages calc' },
              { num: '7', title: 'Resort Profile', sub: 'Regulatory action history' },
              { num: '8', title: 'Negotiation History', sub: 'Round-by-round summary' },
              { num: '9', title: 'Demand Letter Draft', sub: 'Attorney-ready letter' },
              { num: '10', title: 'CFPB Complaint', sub: 'Pre-filled complaint form' },
              { num: '11', title: 'Supporting Documents', sub: 'S3 presigned URL index' },
            ].map((s) => (
              <div key={s.num} className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-indigo-400 font-mono font-bold mt-0.5">§{s.num}</span>
                  <div>
                    <p className="text-xs font-medium text-slate-200">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pack History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Pack History
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Version</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Strength</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Pages</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Generated</th>
                <th className="text-right px-6 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-4 text-slate-500 italic" colSpan={6}>
                  No packs generated for this case yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
