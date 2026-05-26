import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Evidence Packs — all generated packs across all cases.
 * Ops staff can download, resend, or regenerate from this view.
 */
export default async function EvidencePacksPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Attorney Evidence Packs</h1>
            <p className="text-slate-500 text-sm mt-1">AI-assembled legal case files</p>
          </div>
          <a
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Dashboard
          </a>
        </div>

        {/* Status Filters */}
        <div className="flex gap-3 mb-6">
          {['ALL', 'GENERATING', 'READY', 'DELIVERED', 'FAILED'].map((status) => (
            <button
              key={status}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
            >
              {status}
            </button>
          ))}
        </div>

        {/* Packs Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Pack ID</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Case ID</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Strength</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Pages</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Generated</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Delivered To</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Placeholder row — wire to evidence-pack-service API in production */}
              <tr className="border-b border-slate-800/50">
                <td className="px-4 py-3 text-slate-500 italic" colSpan={8}>
                  No evidence packs generated yet. Packs are created automatically when a case
                  reaches ESCALATED_LEGAL status or a LITIGATION strategy is selected.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { status: 'GENERATING', color: 'text-yellow-400', description: 'AI assemblers running' },
            { status: 'READY', color: 'text-blue-400', description: 'PDF ready, not yet delivered' },
            { status: 'DELIVERED', color: 'text-green-400', description: 'Sent to attorney email' },
            { status: 'FAILED', color: 'text-red-400', description: 'Generation error — see logs' },
          ].map((item) => (
            <div key={item.status} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className={`text-xs font-bold ${item.color}`}>{item.status}</p>
              <p className="text-xs text-slate-500 mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
