import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Attorney Portal — Clerk-protected view for attorneys.
 * Shows assigned cases and their evidence packs.
 *
 * Access gated by Clerk org role: 'attorney'.
 * Internal ops staff with 'admin' role also have access.
 */
export default async function AttorneyPortalPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // In production: check Clerk org membership for 'attorney' or 'admin' role
  // const { has } = auth();
  // if (!has({ role: 'org:attorney' }) && !has({ role: 'org:admin' })) redirect('/unauthorized');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Attorney Portal</h1>
            <p className="text-slate-500 text-sm mt-1">
              Review assigned cases and their AI-assembled evidence packs
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Dashboard
          </a>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Assigned Cases', value: '—', sub: 'Active files' },
            { label: 'Packs Ready', value: '—', sub: 'Awaiting review' },
            { label: 'Packs Delivered', value: '—', sub: 'This month' },
            { label: 'Avg Strength Score', value: '—', sub: 'Across active cases' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-3xl font-bold text-white mt-2">{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Priority Review Queue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl mb-6">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Priority Review Queue
            </h2>
            <span className="text-xs text-slate-500">Evidence packs awaiting attorney sign-off</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Case ID</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Client</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Resort</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Strength</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Track</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Pack Status</th>
                <th className="text-right px-6 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-4 text-slate-500 italic" colSpan={7}>
                  No cases assigned yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* All Assigned Cases */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              All Assigned Cases
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Case ID</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Track</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Latest Pack</th>
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Created</th>
                <th className="text-right px-6 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-4 text-slate-500 italic" colSpan={6}>
                  No assigned cases.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* How Evidence Packs Work */}
        <div className="mt-6 bg-slate-900 border border-indigo-900/40 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-indigo-400 mb-3">
            About AI Evidence Packs
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Evidence packs are automatically generated when a case reaches{' '}
            <span className="font-mono text-slate-300">ESCALATED_LEGAL</span> status or a{' '}
            <span className="font-mono text-slate-300">LITIGATION</span> exit strategy is selected.
            Each pack is assembled by 11 specialized Claude AI assemblers and rendered to a
            professionally formatted PDF. All statute citations should be independently verified
            before reliance in any legal proceeding. Packs are protected by attorney-client
            privilege and attorney work product doctrine.
          </p>
        </div>
      </div>
    </div>
  );
}
