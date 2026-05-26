"use client";

import { useEffect, useState } from "react";
import type { ResortBasicsData, MisrepresentationData, QualificationResult } from "../types";

interface Props {
  resortData: ResortBasicsData;
  misrepData: MisrepresentationData;
  onResult: (result: QualificationResult) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepQualification({ resortData, misrepData, onResult, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<QualificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQualification() {
      try {
        const resp = await fetch("/api/intake/qualify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resort_name: resortData.resortName,
            purchase_price: resortData.purchasePrice,
            maintenance_fee_annual: resortData.maintenanceFeeAnnual,
            outstanding_mortgage: resortData.outstandingMortgage,
            misrepresentation_count: misrepData.misrepresentationCount,
            financial_hardship: misrepData.hasFinancialHardship,
          }),
        });

        if (!resp.ok) throw new Error("Qualification request failed");
        const data = await resp.json() as {
          score: number; eligible: boolean;
          estimated_recovery_low: number; estimated_recovery_high: number;
          recommended_track: string; explanation: string;
        };

        const qual: QualificationResult = {
          score: data.score,
          eligible: data.eligible,
          estimatedRecoveryLow: data.estimated_recovery_low,
          estimatedRecoveryHigh: data.estimated_recovery_high,
          recommendedTrack: data.recommended_track,
          explanation: data.explanation,
        };

        setResult(qual);
        onResult(qual);
      } catch {
        setError("Unable to complete assessment. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    void fetchQualification();
  }, [resortData, misrepData, onResult]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Live Assessment</h2>
        <p className="text-slate-400 text-sm">Analysing your case in real time…</p>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Running qualification engine…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className={`rounded-lg border p-5 ${result.eligible
            ? "bg-emerald-900/30 border-emerald-800"
            : "bg-amber-900/30 border-amber-800"
          }`}>
            <p className={`font-bold text-lg mb-1 ${result.eligible ? "text-emerald-400" : "text-amber-400"}`}>
              {result.eligible ? "✓ You Qualify for Exit Assistance" : "⚠ Limited Options Available"}
            </p>
            <p className="text-sm text-slate-300">{result.explanation}</p>
          </div>

          {result.eligible && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Estimated Recovery</p>
                <p className="text-white font-bold">
                  {fmt(result.estimatedRecoveryLow)} – {fmt(result.estimatedRecoveryHigh)}
                </p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Recommended Track</p>
                <p className="text-white font-bold capitalize">
                  {result.recommendedTrack.replace(/_/g, " ").toLowerCase()}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-lg transition-colors">
              ← Back
            </button>
            {result.eligible && (
              <button onClick={onNext} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors">
                Continue →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
