import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-2 text-indigo-300 text-sm mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            $0 upfront · 7% only on success
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Exit Your Timeshare.{' '}
            <span className="text-indigo-400">Pay Nothing</span> Until We Win.
          </h1>

          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            ExitForge's AI platform analyzes your contract, selects the optimal exit strategy,
            and negotiates directly with your resort. We earn 7% only when you're free.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/intake"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
            >
              Check My Eligibility — Free
            </Link>
            <Link
              href="/how-it-works"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
            >
              How It Works
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-lg mx-auto">
            <div>
              <p className="text-3xl font-bold text-white">$0</p>
              <p className="text-slate-400 text-sm mt-1">Upfront cost</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">7%</p>
              <p className="text-slate-400 text-sm mt-1">Contingency fee</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">90%+</p>
              <p className="text-slate-400 text-sm mt-1">Target success rate</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
