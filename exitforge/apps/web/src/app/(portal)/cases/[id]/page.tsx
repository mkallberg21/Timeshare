import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CaseStatusTimeline } from '@/components/case/CaseStatusTimeline';
import { CaseMetrics } from '@/components/case/CaseMetrics';
import { NegotiationHistory } from '@/components/case/NegotiationHistory';
import { MessageCenter } from '@/components/case/MessageCenter';
import { DocumentVault } from '@/components/case/DocumentVault';
import { FeeCalculator } from '@/components/case/FeeCalculator';
import { CaseStatusBadge } from '@/components/case/CaseStatusBadge';
import { getCase } from '@/lib/api/cases';

interface Props {
  params: { id: string };
}

export default async function CasePage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) notFound();

  const case_ = await getCase(params.id);
  if (!case_) notFound();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {case_.timeshare?.resort?.name ?? 'Unknown Resort'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Case #{case_.id.slice(-8).toUpperCase()}
          </p>
        </div>
        <CaseStatusBadge status={case_.status} />
      </div>

      {/* Status Timeline */}
      <CaseStatusTimeline
        currentStatus={case_.status}
        events={case_.events ?? []}
        timelineP50={case_.timelineP50Days}
        timelineP90={case_.timelineP90Days}
      />

      {/* Key Metrics */}
      <CaseMetrics
        maintenanceFeeAnnual={case_.timeshare?.maintenanceFeeAnnual ?? 0}
        outstandingMortgage={case_.timeshare?.outstandingMortgage ?? 0}
        probabilityScore={case_.probabilityScore}
        fee={case_.fee}
      />

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<LoadingCard label="negotiations" />}>
            <NegotiationHistory negotiations={case_.negotiations ?? []} />
          </Suspense>

          <Suspense fallback={<LoadingCard label="documents" />}>
            <DocumentVault caseId={case_.id} documents={case_.documents ?? []} />
          </Suspense>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<LoadingCard label="messages" />}>
            <MessageCenter caseId={case_.id} messages={case_.messages ?? []} />
          </Suspense>

          <FeeCalculator
            basisAmount={
              (case_.timeshare?.outstandingMortgage ?? 0) +
              (case_.timeshare?.maintenanceFeeAnnual ?? 0) * 5
            }
            feeRate={0.07}
          />
        </div>
      </div>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <div className="animate-pulse h-4 bg-slate-700 rounded w-1/3 mb-4" />
      <div className="text-sm text-slate-500">Loading {label}...</div>
    </div>
  );
}
