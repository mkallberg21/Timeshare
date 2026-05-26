"use client";

import { useState } from "react";
import type { ResortBasicsData } from "../types";

interface Props {
  initialData: ResortBasicsData | null;
  onNext: (data: ResortBasicsData) => void;
}

export function StepResortBasics({ initialData, onNext }: Props) {
  const [form, setForm] = useState<Partial<ResortBasicsData>>(initialData ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.resortName?.trim()) errs.resortName = "Resort name is required";
    if (!form.contractYear || form.contractYear < 1980 || form.contractYear > new Date().getFullYear())
      errs.contractYear = "Enter a valid contract year";
    if (!form.purchasePrice || form.purchasePrice <= 0) errs.purchasePrice = "Enter purchase price";
    if (form.maintenanceFeeAnnual == null || form.maintenanceFeeAnnual < 0)
      errs.maintenanceFeeAnnual = "Enter annual maintenance fee";
    if (form.outstandingMortgage == null || form.outstandingMortgage < 0)
      errs.outstandingMortgage = "Enter remaining mortgage (0 if paid off)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onNext({
      resortId: form.resortId ?? `resort_${form.resortName?.toLowerCase().replace(/\s+/g, "_")}`,
      resortName: form.resortName!,
      contractYear: Number(form.contractYear),
      purchasePrice: Number(form.purchasePrice),
      maintenanceFeeAnnual: Number(form.maintenanceFeeAnnual),
      outstandingMortgage: Number(form.outstandingMortgage ?? 0),
      contractS3Key: form.contractS3Key ?? "",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Resort Details</h2>
        <p className="text-slate-400 text-sm">Tell us about your timeshare.</p>
      </div>

      {[
        { id: "resortName", label: "Resort Name", type: "text", placeholder: "e.g. Wyndham Grand Desert" },
        { id: "contractYear", label: "Year Purchased", type: "number", placeholder: "e.g. 2015" },
        { id: "purchasePrice", label: "Original Purchase Price ($)", type: "number", placeholder: "e.g. 25000" },
        { id: "maintenanceFeeAnnual", label: "Annual Maintenance Fee ($)", type: "number", placeholder: "e.g. 1800" },
        { id: "outstandingMortgage", label: "Outstanding Mortgage Balance ($)", type: "number", placeholder: "0 if paid off" },
      ].map(({ id, label, type, placeholder }) => (
        <div key={id}>
          <label className="block text-sm text-slate-300 mb-1" htmlFor={id}>{label}</label>
          <input
            id={id}
            type={type}
            placeholder={placeholder}
            value={(form as Record<string, unknown>)[id] as string ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm
              placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors[id] && <p className="text-red-400 text-xs mt-1">{errors[id]}</p>}
        </div>
      ))}

      <button
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3
          rounded-lg transition-colors"
      >
        Continue →
      </button>
    </form>
  );
}
