interface Props {
  maintenanceFeeAnnual: number;
  outstandingMortgage: number;
  probabilityScore: number | null;
  fee: unknown | null;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function CaseMetrics({ maintenanceFeeAnnual, outstandingMortgage, probabilityScore }: Props) {
  const maintenanceSavings = maintenanceFeeAnnual * 5;
  const totalBasis = outstandingMortgage + maintenanceSavings;
  const estimatedFee = totalBasis * 0.07;

  const metrics = [
    {
      label: 'Annual Maintenance Fee',
      value: formatCurrency(maintenanceFeeAnnual),
      sub: `${formatCurrency(maintenanceSavings)} saved over 5 years`,
      color: 'text-red-400',
    },
    {
      label: 'Outstanding Mortgage',
      value: formatCurrency(outstandingMortgage),
      sub: outstandingMortgage > 0 ? 'Will be eliminated on exit' : 'Paid off — no balance',
      color: outstandingMortgage > 0 ? 'text-orange-400' : 'text-green-400',
    },
    {
      label: 'Exit Probability',
      value: probabilityScore !== null ? `${(probabilityScore * 100).toFixed(0)}%` : '—',
      sub: 'ML model confidence',
      color: probabilityScore && probabilityScore >= 0.65 ? 'text-green-400' : 'text-slate-400',
    },
    {
      label: 'Estimated Fee (7%)',
      value: formatCurrency(estimatedFee),
      sub: `Only paid on successful exit`,
      color: 'text-indigo-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="bg-slate-900 border border-slate-800 rounded-xl p-4"
        >
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{m.label}</p>
          <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
          <p className="text-xs text-slate-500 mt-1">{m.sub}</p>
        </div>
      ))}
    </div>
  );
}
