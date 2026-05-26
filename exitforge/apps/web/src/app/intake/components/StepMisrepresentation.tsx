"use client";

import { useState } from "react";
import type { MisrepresentationData } from "../types";

const ISSUE_OPTIONS = [
  "High-pressure sales tactics",
  "False promises about rental income",
  "Misrepresented resale value",
  "Hidden fees not disclosed",
  "Perpetual contract not clearly explained",
  "Salesperson lied about cancellation rights",
  "Financial details misrepresented",
];

interface Props {
  initialData: MisrepresentationData | null;
  onNext: (data: MisrepresentationData) => void;
  onBack: () => void;
}

export function StepMisrepresentation({ initialData, onNext, onBack }: Props) {
  const [issues, setIssues] = useState<string[]>(initialData?.issues ?? []);
  const [hardship, setHardship] = useState(initialData?.hasFinancialHardship ?? false);
  const [perpetual, setPerpetual] = useState(initialData?.hasPerpetualContract ?? false);

  function toggleIssue(issue: string) {
    setIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  }

  function handleNext() {
    onNext({
      misrepresentationCount: issues.length,
      hasFinancialHardship: hardship,
      hasPerpetualContract: perpetual,
      issues,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Your Experience</h2>
        <p className="text-slate-400 text-sm">Select all issues that apply to your situation.</p>
      </div>

      <div className="space-y-3">
        {ISSUE_OPTIONS.map((issue) => (
          <label key={issue} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={issues.includes(issue)}
              onChange={() => toggleIssue(issue)}
              className="mt-0.5 rounded border-slate-600 bg-slate-800 text-indigo-600
                focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
              {issue}
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-3 pt-2 border-t border-slate-800">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hardship}
            onChange={(e) => setHardship(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-indigo-600"
          />
          <span className="text-sm text-slate-300">I am experiencing financial hardship</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={perpetual}
            onChange={(e) => setPerpetual(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-indigo-600"
          />
          <span className="text-sm text-slate-300">My contract has perpetuity language ("forever")</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-2 flex-grow-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
