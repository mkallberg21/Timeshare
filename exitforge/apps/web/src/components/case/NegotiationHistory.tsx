import type { Negotiation } from '@exitforge/shared';

interface Props {
  negotiations: Negotiation[];
}

const TRACK_LABELS: Record<string, string> = {
  DEED_BACK: 'Deed-Back',
  LEGAL_DEMAND: 'Legal Demand',
  REGULATORY_PRESSURE: 'Regulatory',
  LITIGATION: 'Litigation',
};

const RESPONSE_COLORS: Record<string, string> = {
  ACCEPTED: 'text-green-400',
  REJECTED: 'text-red-400',
  COUNTER: 'text-yellow-400',
  LEGAL_THREAT: 'text-orange-400',
  NO_RESPONSE: 'text-slate-400',
};

export function NegotiationHistory({ negotiations }: Props) {
  if (negotiations.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">Negotiation History</h3>
        <p className="text-slate-500 text-sm">
          Negotiations will appear here once your exit strategy is activated.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h3 className="text-base font-semibold text-white mb-4">
        Negotiation History
        <span className="ml-2 text-sm font-normal text-slate-500">
          {negotiations.length} round{negotiations.length !== 1 ? 's' : ''}
        </span>
      </h3>

      <div className="space-y-3">
        {negotiations.map((neg) => (
          <div
            key={neg.id}
            className="flex items-start justify-between py-3 border-b border-slate-800 last:border-0"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold shrink-0">
                {neg.roundNumber}
              </div>
              <div>
                <p className="text-sm text-white font-medium">
                  {TRACK_LABELS[neg.track] ?? neg.track} — Round {neg.roundNumber}
                </p>
                {neg.sentAt && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sent {new Date(neg.sentAt).toLocaleDateString()}
                  </p>
                )}
                {neg.nextAction && (
                  <p className="text-xs text-slate-400 mt-1">Next: {neg.nextAction}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              {neg.responseType && (
                <span className={`text-xs font-medium ${RESPONSE_COLORS[neg.responseType] ?? 'text-slate-400'}`}>
                  {neg.responseType.replace('_', ' ')}
                </span>
              )}
              {!neg.responseType && neg.sentAt && (
                <span className="text-xs text-slate-500">Awaiting response</span>
              )}
              {!neg.sentAt && (
                <span className="text-xs text-yellow-400">Pending review</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
