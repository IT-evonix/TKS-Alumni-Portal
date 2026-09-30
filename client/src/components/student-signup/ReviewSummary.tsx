import React from "react";
import { GraduationCap, Lock, Pencil, UserRound } from "lucide-react";
import type { StudentSignupForm } from "@/utils/studentSignupFields";
import { isPhoneEmpty } from "@/utils/studentSignupFields";

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

interface ReviewSummaryProps {
  form: StudentSignupForm;
  onEdit: (step: number) => void;
}

const Section = ({
  title,
  step,
  onEdit,
  rows,
  icon: Icon,
  chip,
}: {
  icon: React.ElementType;
  chip: string;
  title: string;
  step: number;
  onEdit: (step: number) => void;
  rows: [string, string][];
}) => (
  <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <header className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-[#f1f8f5] to-white px-4 py-3">
      <h3 className="flex items-center gap-2.5 text-sm font-bold text-gray-900">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${chip}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        {title}
      </h3>
      <button
        type="button"
        onClick={() => onEdit(step)}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[#008060] hover:bg-[#e6f5f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008060]/40"
        aria-label={`Edit ${title.toLowerCase()}`}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Edit
      </button>
    </header>
    <dl className="divide-y divide-gray-100">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <dt className="shrink-0 text-sm text-gray-500">{k}</dt>
          <dd className="min-w-0 break-words text-right text-sm font-semibold text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export const ReviewSummary = ({ form, onEdit }: ReviewSummaryProps) => (
  <div className="space-y-3">
    <Section
      title="Personal"
      icon={UserRound}
      chip="bg-emerald-100 text-emerald-700"
      step={0}
      onEdit={onEdit}
      rows={[
        ["Name", `${form.firstName.trim()} ${form.lastName.trim()}`],
        ["Gender", GENDER_LABELS[form.gender] ?? form.gender],
      ]}
    />
    <Section
      title="School"
      icon={GraduationCap}
      chip="bg-amber-100 text-amber-700"
      step={1}
      onEdit={onEdit}
      rows={[
        ["Roll number", form.rollNumber.trim().toUpperCase()],
        ["Graduation year", form.graduationYear],
        ["Phone", isPhoneEmpty(form.phone) ? "Not provided" : form.phone],
      ]}
    />
    <Section
      title="Account"
      icon={Lock}
      chip="bg-lime-100 text-lime-700"
      step={2}
      onEdit={onEdit}
      rows={[
        ["Email", form.email.trim().toLowerCase()],
        ["Password", "••••••••"],
      ]}
    />
  </div>
);
