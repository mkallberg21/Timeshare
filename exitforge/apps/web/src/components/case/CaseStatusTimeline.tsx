'use client';

import type { CaseStatus } from '@exitforge/shared';

const TIMELINE_STEPS: Array<{ status: CaseStatus; label: string }> = [
  { status: 'INTAKE', label: 'Intake' },
  { status: 'QUALIFICATION', label: 'Qualification' },
  { status: 'DOCUMENT_REVIEW', label: 'Contract Review' },
  { status: 'STRATEGY_SELECTED', label: 'Strategy' },
  { status: 'NEGOTIATION_ACTIVE', label: 'Negotiation' },
  { status: 'EXIT_CONFIRMED', label: 'Exit Confirmed' },
  { status: 'CLOSED_SUCCESS', label: 'Closed' },
];

const STATUS_ORDER: Record<CaseStatus, number> = {
  INTAKE: 0,
  QUALIFICATION: 1,
  DOCUMENT_REVIEW: 2,
  STRATEGY_SELECTED: 3,
  NEGOTIATION_ACTIVE: 4,
  NEGOTIATION_STALLED: 4,
  ESCALATED_LEGAL: 4,
  RESORT_RESPONDED: 4,
  SETTLEMENT_REVIEW: 5,
  EXIT_CONFIRMED: 5,
  FEE_CALCULATED: 5,
  ESCROW_RELEASED: 6,
  CLOSED_SUCCESS: 6,
  CLOSED_FAILURE: 6,
};

interface Props {
  currentStatus: CaseStatus;
  events: unknown[];
  timelineP50: number | null;
  timelineP90: number | null;
}

export function CaseStatusTimeline({ currentStatus, timelineP50, timelineP90 }: Props) {
  const currentStep = STATUS_ORDER[currentStatus] ?? 0;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Case Progress</h2>
        {timelineP50 !== null && (
          <div className="text-sm text-slate-400">
            <span className="text-white font-medium">{timelineP50}</span> days median ·{' '}
            <span className="text-white font-medium">{timelineP90}</span> days P90
          </div>
        )}
      </div>

      {/* Progress steps */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {TIMELINE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isFailed = currentStatus === 'CLOSED_FAILURE';

            return (
              <div key={step.status} className="flex flex-col items-center flex-1 relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div
                    className={`absolute left-0 right-1/2 top-4 h-0.5 -translate-y-1/2 ${
                      isCompleted || isCurrent ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                  />
                )}
                {idx < TIMELINE_STEPS.length - 1 && (
                  <div
                    className={`absolute left-1/2 right-0 top-4 h-0.5 -translate-y-1/2 ${
                      isCompleted ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                  />
                )}

                {/* Circle */}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    isFailed && idx >= currentStep
                      ? 'border-red-500 bg-red-500/20 text-red-400'
                      : isCompleted
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : isCurrent
                          ? 'border-indigo-400 bg-indigo-400/20 text-indigo-400'
                          : 'border-slate-600 bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>

                {/* Label */}
                <span
                  className={`mt-2 text-xs text-center ${
                    isCompleted || isCurrent ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
