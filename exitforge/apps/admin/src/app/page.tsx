import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Admin dashboard — ops overview with pipeline health metrics.
 * Internal staff only.
 */
export default async function AdminDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">ExitForge Ops</h1>
            <p className="text-slate-500 text-sm mt-1">Internal operations dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-slate-400">All systems operational</span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Cases', value: '—', sub: 'Cases in pipeline' },
            { label: 'AI Escalation Rate', value: '—', sub: 'Target < 20%' },
            { label: 'Avg Days to Close', value: '—', sub: 'vs P50 prediction' },
            { label: 'Revenue in Escrow', value: '$—', sub: 'Pending release' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-3xl font-bold text-white mt-2">{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Attorney Review Queue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Attorney Review Queue</h2>
          <p className="text-slate-500 text-sm">
            Letters pending attorney review will appear here. Connect to legal-service API.
          </p>
        </div>

        {/* Human Review Required */}
        <div className="bg-slate-900 border border-amber-700/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <h2 className="text-lg font-semibold text-white">Requires Human Review</h2>
          </div>
          <p className="text-slate-500 text-sm">
            Cases flagged by AI for human intervention will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
