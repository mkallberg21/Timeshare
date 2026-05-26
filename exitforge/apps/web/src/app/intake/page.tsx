"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StepResortBasics } from "./components/StepResortBasics";
import { StepMisrepresentation } from "./components/StepMisrepresentation";
import { StepQualification } from "./components/StepQualification";
import { StepAgreement } from "./components/StepAgreement";
import type {
  ResortBasicsData,
  MisrepresentationData,
  QualificationResult,
  IntakeFormData,
} from "./types";

const STEPS = [
  { id: 1, label: "Resort Details" },
  { id: 2, label: "Your Experience" },
  { id: 3, label: "Live Assessment" },
  { id: 4, label: "Get Started" },
];

export default function IntakePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [resortData, setResortData] = useState<ResortBasicsData | null>(null);
  const [misrepData, setMisrepData] = useState<MisrepresentationData | null>(null);
  const [qualResult, setQualResult] = useState<QualificationResult | null>(null);

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, 4)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const handleComplete = useCallback(async () => {
    if (!resortData || !misrepData || !qualResult) return;

    const payload: IntakeFormData = {
      resortId: resortData.resortId,
      contractYear: resortData.contractYear,
      purchasePrice: resortData.purchasePrice,
      maintenanceFeeAnnual: resortData.maintenanceFeeAnnual,
      outstandingMortgage: resortData.outstandingMortgage,
      contractS3Key: resortData.contractS3Key,
    };

    const resp = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      console.error("Failed to create case");
      return;
    }

    const { id } = (await resp.json()) as { id: string };
    router.push(`/cases/${id}`);
  }, [resortData, misrepData, qualResult, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-400 mb-2">
            Free Case Evaluation
          </h1>
          <p className="text-slate-400 text-sm">
            Takes less than 3 minutes. No credit card required.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1
                  ${step >= s.id ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}`}
              >
                {s.id}
              </div>
              <span className="text-xs text-slate-500 hidden sm:block">{s.label}</span>
              {i < STEPS.length - 1 && (
                <div
                  className={`hidden sm:block absolute h-0.5 w-full translate-x-1/2
                    ${step > s.id ? "bg-indigo-600" : "bg-slate-700"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
          {step === 1 && (
            <StepResortBasics
              initialData={resortData}
              onNext={(data) => { setResortData(data); goNext(); }}
            />
          )}
          {step === 2 && (
            <StepMisrepresentation
              initialData={misrepData}
              onNext={(data) => { setMisrepData(data); goNext(); }}
              onBack={goBack}
            />
          )}
          {step === 3 && resortData && misrepData && (
            <StepQualification
              resortData={resortData}
              misrepData={misrepData}
              onResult={(result) => { setQualResult(result); }}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {step === 4 && qualResult && (
            <StepAgreement
              qualResult={qualResult}
              onConfirm={handleComplete}
              onBack={goBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}
