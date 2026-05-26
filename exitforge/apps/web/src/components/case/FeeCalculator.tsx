interface Props {
  basisAmount: number;
  feeRate: number;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function FeeCalculator({ basisAmount, feeRate }: Props) {
  const feeAmount = basisAmount * feeRate;

  return (
    <div className="bg-slate-900 border border-indigo-800/50 rounded-xl p-5">
      <h3 className="text-base font-semibold text-white mb-4">Contingency Fee</h3>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Recovery basis</span>
          <span className="text-white font-medium">{formatCurrency(basisAmount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Fee rate</span>
          <span className="text-white font-medium">{(feeRate * 100).toFixed(0)}%</span>
        </div>
        <div className="border-t border-slate-700 pt-3 flex justify-between">
          <span className="text-slate-300 font-medium">Our fee</span>
          <span className="text-indigo-400 font-bold text-lg">{formatCurrency(feeAmount)}</span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
        <p className="text-xs text-green-400 font-medium">
          $0 upfront · Paid only on successful exit
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Fee held in Escrow.com until exit is fully confirmed.
        </p>
      </div>
    </div>
  );
}
