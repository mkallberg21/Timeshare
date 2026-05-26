import type { CaseStatus } from '@exitforge/shared';

const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  INTAKE: { label: 'Intake', color: 'text-slate-400', bg: 'bg-slate-400/10', dot: 'bg-slate-400' },
  QUALIFICATION: { label: 'Qualifying', color: 'text-yellow-400', bg: 'bg-yellow-400/10', dot: 'bg-yellow-400' },
  DOCUMENT_REVIEW: { label: 'Document Review', color: 'text-blue-400', bg: 'bg-blue-400/10', dot: 'bg-blue-400' },
  STRATEGY_SELECTED: { label: 'Strategy Selected', color: 'text-indigo-400', bg: 'bg-indigo-400/10', dot: 'bg-indigo-400' },
  NEGOTIATION_ACTIVE: { label: 'Negotiating', color: 'text-amber-400', bg: 'bg-amber-400/10', dot: 'bg-amber-400' },
  NEGOTIATION_STALLED: { label: 'Stalled', color: 'text-orange-400', bg: 'bg-orange-400/10', dot: 'bg-orange-400' },
  ESCALATED_LEGAL: { label: 'Legal Escalated', color: 'text-purple-400', bg: 'bg-purple-400/10', dot: 'bg-purple-400' },
  RESORT_RESPONDED: { label: 'Resort Responded', color: 'text-cyan-400', bg: 'bg-cyan-400/10', dot: 'bg-cyan-400' },
  SETTLEMENT_REVIEW: { label: 'Settlement Review', color: 'text-teal-400', bg: 'bg-teal-400/10', dot: 'bg-teal-400' },
  EXIT_CONFIRMED: { label: 'Exit Confirmed', color: 'text-green-400', bg: 'bg-green-400/10', dot: 'bg-green-400' },
  FEE_CALCULATED: { label: 'Fee Calculated', color: 'text-green-400', bg: 'bg-green-400/10', dot: 'bg-green-400' },
  ESCROW_RELEASED: { label: 'Escrow Released', color: 'text-emerald-400', bg: 'bg-emerald-400/10', dot: 'bg-emerald-400' },
  CLOSED_SUCCESS: { label: 'Closed — Success', color: 'text-emerald-400', bg: 'bg-emerald-400/10', dot: 'bg-emerald-400' },
  CLOSED_FAILURE: { label: 'Closed — Unsuccessful', color: 'text-red-400', bg: 'bg-red-400/10', dot: 'bg-red-400' },
};

interface Props {
  status: CaseStatus;
}

export function CaseStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.INTAKE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
