import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-400">ExitForge</span>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
            <a href="/cases" className="hover:text-white transition-colors">My Cases</a>
            <a href="/documents" className="hover:text-white transition-colors">Documents</a>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
