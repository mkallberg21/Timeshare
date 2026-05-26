import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

interface CaseListItem {
  id: string;
  status: string;
  exitTrack: string | null;
  probabilityScore: number | null;
  timelineP50Days: number | null;
  createdAt: string;
  timeshare?: { resortId: string } | null;
}

async function getCases(userId: string): Promise<CaseListItem[]> {
  const baseUrl = process.env["CASE_SERVICE_URL"] ?? "http://case-service:4000";
  try {
    const resp = await fetch(`${baseUrl}/api/v1/cases`, {
      headers: {
        "x-clerk-user-id": userId,
        "Content-Type": "application/json",
      },
      next: { revalidate: 30 },
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { data: CaseListItem[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    INTAKE: "bg-slate-700 text-slate-300",
    QUALIFICATION: "bg-blue-900/50 text-blue-300",
    NEGOTIATION_ACTIVE: "bg-indigo-900/50 text-indigo-300",
    CLOSED_SUCCESS: "bg-emerald-900/50 text-emerald-300",
    CLOSED_FAILURE: "bg-red-900/50 text-red-300",
  };
  const colour = colours[status] ?? "bg-slate-700 text-slate-400";
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colour}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const cases = await getCases(userId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Cases</h1>
          <p className="text-slate-400 text-sm mt-1">Track your timeshare exit progress.</p>
        </div>
        <Link
          href="/intake"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          + New Case
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 rounded-2xl border border-slate-800">
          <p className="text-slate-400 mb-4">You don&apos;t have any cases yet.</p>
          <Link
            href="/intake"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg text-sm transition-colors"
          >
            Start Free Evaluation
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="block bg-slate-900 rounded-xl border border-slate-800 hover:border-indigo-700 p-5 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={c.status} />
                <span className="text-xs text-slate-500">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Track</p>
                  <p className="text-white font-medium">
                    {c.exitTrack?.replace(/_/g, " ") ?? "Pending"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Success Probability</p>
                  <p className="text-white font-medium">
                    {c.probabilityScore != null
                      ? `${Math.round(c.probabilityScore * 100)}%`
                      : "Analysing…"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Est. Timeline (P50)</p>
                  <p className="text-white font-medium">
                    {c.timelineP50Days != null ? `${c.timelineP50Days} days` : "Pending"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
