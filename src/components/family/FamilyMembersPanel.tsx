import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FamilyMember, FamilyProfile } from "../../types";

interface FamilyMembersPanelProps {
  familyProfile: FamilyProfile;
  onUpdateProfile: (profile: FamilyProfile) => void;
}

const SENSITIVITY_OPTIONS = [
  "Mild Childhood Asthma",
  "Seasonal Allergic Rhinitis",
  "Cardiorespiratory Sensitivity",
  "Outdoor Sports",
  "Infant / Toddler Airways",
];

export const FamilyMembersPanel: React.FC<FamilyMembersPanelProps> = ({
  familyProfile,
  onUpdateProfile,
}) => {
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberAge, setNewMemberAge] =
    useState<FamilyMember["ageGroup"]>("Child (5–12)");
  const [newMemberSensitivities, setNewMemberSensitivities] = useState<string[]>([
    "Outdoor Sports",
  ]);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const member: FamilyMember = {
      id: `m-${Date.now()}`,
      name: newMemberName.trim(),
      ageGroup: newMemberAge,
      sensitivities: newMemberSensitivities,
    };
    onUpdateProfile({
      ...familyProfile,
      members: [...familyProfile.members, member],
    });
    setNewMemberName("");
  };

  const handleRemoveMember = (id: string) => {
    if (familyProfile.members.length <= 1) return;
    onUpdateProfile({
      ...familyProfile,
      members: familyProfile.members.filter((m) => m.id !== id),
    });
  };

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Household Members &amp; Respiratory Sensitivities
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Gemini routines and outdoor safety advice adapt to the youngest and most sensitive members in your household.
        </p>
      </div>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {familyProfile.members.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {m.name}{" "}
                <span className="font-normal text-xs text-slate-600">· {m.ageGroup}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                {m.sensitivities.length > 0
                  ? m.sensitivities.join(" · ")
                  : "No specific sensitivities"}
              </div>
            </div>
            {familyProfile.members.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveMember(m.id)}
                aria-label={`Remove ${m.name}`}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={handleAddMember}
        className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <div className="text-xs font-semibold text-slate-800">Add Family Member</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-member-name" className="sr-only">
              Family member first name
            </label>
            <input
              id="new-member-name"
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="First name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600 focus:border-teal-700 focus:outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="new-member-age" className="sr-only">
              Age group
            </label>
            <select
              id="new-member-age"
              value={newMemberAge}
              onChange={(e) => setNewMemberAge(e.target.value as FamilyMember["ageGroup"])}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              <option>Toddler (0–4)</option>
              <option>Child (5–12)</option>
              <option>Teen (13–17)</option>
              <option>Adult</option>
              <option>Older Adult (65+)</option>
            </select>
          </div>
        </div>

        <div>
          <div className="pb-1.5 text-xs text-slate-700">Sensitivities</div>
          <div className="flex flex-col gap-1.5">
            {SENSITIVITY_OPTIONS.map((opt) => {
              const checked = newMemberSensitivities.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setNewMemberSensitivities((prev) =>
                        checked ? prev.filter((s) => s !== opt) : [...prev, opt]
                      )
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-700"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="min-h-[40px] flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Member
        </button>
      </form>
    </section>
  );
};
