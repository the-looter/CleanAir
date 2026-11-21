import React from "react";
import { FamilyProfile } from "../../types";

interface HomeBaselinePanelProps {
  familyProfile: FamilyProfile;
  onUpdateProfile: (profile: FamilyProfile) => void;
}

export const HomeBaselinePanel: React.FC<HomeBaselinePanelProps> = ({
  familyProfile,
  onUpdateProfile,
}) => {
  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Home Environment &amp; Commute Baseline
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Used to calibrate indoor PM2.5 infiltration physics and daily low-emission recommendations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="household-name" className="block text-xs font-medium text-slate-700">
            Household Label
          </label>
          <input
            id="household-name"
            type="text"
            value={familyProfile.householdName}
            onChange={(e) =>
              onUpdateProfile({ ...familyProfile, householdName: e.target.value })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="home-type" className="block text-xs font-medium text-slate-700">
            Home Structure
          </label>
          <select
            id="home-type"
            value={familyProfile.homeType}
            onChange={(e) =>
              onUpdateProfile({
                ...familyProfile,
                homeType: e.target.value as FamilyProfile["homeType"],
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          >
            <option>High-Rise Apartment</option>
            <option>Walk-Up Apartment</option>
            <option>Townhouse</option>
            <option>Detached Home</option>
          </select>
        </div>

        <div>
          <label htmlFor="stove-type" className="block text-xs font-medium text-slate-700">
            Primary Cooking Stove
          </label>
          <select
            id="stove-type"
            value={familyProfile.stoveType}
            onChange={(e) =>
              onUpdateProfile({
                ...familyProfile,
                stoveType: e.target.value as FamilyProfile["stoveType"],
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          >
            <option>Gas Range</option>
            <option>Induction / Electric</option>
            <option>Propane / Wood</option>
          </select>
        </div>

        <div>
          <label htmlFor="purifier-count" className="block text-xs font-medium text-slate-700">
            Active HEPA / DIY Purifiers
          </label>
          <input
            id="purifier-count"
            type="number"
            min={0}
            max={10}
            value={familyProfile.purifierCount}
            onChange={(e) =>
              onUpdateProfile({
                ...familyProfile,
                purifierCount: Math.max(0, Number(e.target.value)),
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="commute-mode" className="block text-xs font-medium text-slate-700">
            Primary School &amp; Work Commute
          </label>
          <select
            id="commute-mode"
            value={familyProfile.primaryCommute}
            onChange={(e) =>
              onUpdateProfile({
                ...familyProfile,
                primaryCommute: e.target.value as FamilyProfile["primaryCommute"],
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          >
            <option>Car (Gasoline)</option>
            <option>Public Transit</option>
            <option>Walk / Bike</option>
            <option>EV / Hybrid</option>
          </select>
        </div>
      </div>
    </section>
  );
};
