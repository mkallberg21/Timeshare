"use client";

import { useState } from "react";
import type { QualificationResult } from "../types";

interface Props {
  qualResult: QualificationResult;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

export function StepAgreement({ qualResult, onConfirm, onBack }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed || submitting) return;
    setSubmitting(true);
    await onConfirm();
    setSubmitting(false);
  }

  const fee = ((qualResult.estimatedRecoveryLow + qualResult.estimatedRecoveryHigh) / 2 * 0.07);
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Engagement Agreement</h2>
        <p className="text-slate-400 text-sm">
          Review and accept the terms to begin your exit.
        </p>
      </div>

      <div className="bg-slate-800 rounded-lg p-5 space-y-3 text-sm text-slate-300">
        <div className="flex justify-between">
          <span>Service</span>
          <span className="text-white font-medium">Timeshare Exit</span>
        </div>
        <div className="flex justify-between">
          <span>Strategy</span>
          <span className="text-white font-medium capitalize">
            {qualResult.recommendedTrack.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
        <div className="border-t border-slate-700 pt-3 flex justify-between">
          <span>Success-only fee (7% of recovery basis)</span>
          <span className="text-indigo-400 font-bold">~{fmt(fee)}</span>
        </div>
        <p className="text-xs text-slate-500">
          You only pay if we successfully exit your timeshare. No upfront charges.
        </p>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 text-xs text-slate-400 max-h-32 overflow-y-auto">
        <p className="font-semibold text-slate-300 mb-2">Terms Summary</p>
        <p>ExitForge provides exit strategy advisory services. Our fee of 7% of the
        recovery basis (outstanding mortgage + 5× annual maintenance fee) is due only upon
        successful exit. You may cancel within 3 business days of signing with no penalty.
        ExitForge is not a law firm; legal demand letters are prepared by licensed
        attorneys in our network. Full terms available upon request.</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 rounded border-slate-600 bg-slate-800 text-indigo-600"
        />
        <span className="text-sm text-slate-300">
          I agree to the terms above and authorise ExitForge to begin my exit process.
        </span>
      </label>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-lg transition-colors">
          ← Back
        </button>
        <button
          type="submit"
          disabled={!agreed || submitting}
          className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        >
          {submitting ? "Creating your case…" : "Start My Exit →"}
        </button>
      </div>
    </form>
  );
}
