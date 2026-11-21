import React, { useState } from "react";
import { CityLocation, FamilyProfile } from "../types";
import { FamilyMembersPanel } from "./family/FamilyMembersPanel";
import { HomeBaselinePanel } from "./family/HomeBaselinePanel";
import { LocationSettingsPanel } from "./family/LocationSettingsPanel";

interface FamilyLocationViewProps {
  selectedCity: CityLocation;
  onSelectCity: (city: CityLocation) => void;
  familyProfile: FamilyProfile;
  onUpdateProfile: (profile: FamilyProfile) => void;
}

type SettingsTab = "location" | "members" | "home";

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "location", label: "Location & Air Sensor" },
  { id: "members", label: "Family Members" },
  { id: "home", label: "Home & Appliances" },
];

export const FamilyLocationView: React.FC<FamilyLocationViewProps> = ({
  selectedCity,
  onSelectCity,
  familyProfile,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("location");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4">
        <h1 className="font-display text-xl font-bold text-slate-900">
          Family Profile &amp; Local Monitoring City
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Configure your household members, home appliances, and local air quality monitoring station.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Vertical Configuration Menu */}
        <nav aria-label="Family and location settings" className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="px-2 pb-2 text-xs font-medium text-slate-600">
              Setup &amp; Preferences
            </div>
            <ul className="flex flex-col gap-1">
              {SETTINGS_TABS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-pressed={activeTab === item.id}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      activeTab === item.id
                        ? "bg-teal-50 font-semibold text-teal-900"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Main Settings Content */}
        <div className="lg:col-span-9">
          {activeTab === "location" && (
            <LocationSettingsPanel
              selectedCity={selectedCity}
              onSelectCity={onSelectCity}
            />
          )}

          {activeTab === "members" && (
            <FamilyMembersPanel
              familyProfile={familyProfile}
              onUpdateProfile={onUpdateProfile}
            />
          )}

          {activeTab === "home" && (
            <HomeBaselinePanel
              familyProfile={familyProfile}
              onUpdateProfile={onUpdateProfile}
            />
          )}
        </div>
      </div>
    </div>
  );
};
