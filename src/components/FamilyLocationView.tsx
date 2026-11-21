import React, { useState } from "react";
import { LocateFixed, Plus, Search, Trash2 } from "lucide-react";
import { PRESET_CITIES } from "../data/knowledgeBase";
import { searchCities } from "../services/api";
import { CityLocation, FamilyMember, FamilyProfile } from "../types";

interface FamilyLocationViewProps {
  selectedCity: CityLocation;
  onSelectCity: (city: CityLocation) => void;
  familyProfile: FamilyProfile;
  onUpdateProfile: (profile: FamilyProfile) => void;
}

type SettingsTab = "location" | "members" | "home";

const SENSITIVITY_OPTIONS = [
  "Mild Childhood Asthma",
  "Seasonal Allergic Rhinitis",
  "Cardiorespiratory Sensitivity",
  "Outdoor Sports",
  "Infant / Toddler Airways",
];

export const FamilyLocationView: React.FC<FamilyLocationViewProps> = ({
  selectedCity,
  onSelectCity,
  familyProfile,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("location");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CityLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberAge, setNewMemberAge] =
    useState<FamilyMember["ageGroup"]>("Child (5–12)");
  const [newMemberSensitivities, setNewMemberSensitivities] = useState<string[]>([
    "Outdoor Sports",
  ]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const results = await searchCities(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No matching cities found. Try another city name.");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "City lookup failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation is not supported in this browser.");
      return;
    }
    setGeoStatus("Requesting browser coordinates...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus(null);
        onSelectCity({
          id: `gps-${Date.now()}`,
          name: "My Current Location",
          region: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
          country: "Local GPS",
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
        });
      },
      (err) => {
        setGeoStatus(`Could not read location: ${err.message}`);
      }
    );
  };

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Vertical Configuration Menu */}
      <aside className="lg:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="px-2 pb-2 text-xs font-medium text-slate-500">
            Setup & Preferences
          </div>
          <ul className="flex flex-col gap-1">
            {[
              { id: "location" as SettingsTab, label: "Location & Air Sensor" },
              { id: "members" as SettingsTab, label: "Family Members" },
              { id: "home" as SettingsTab, label: "Home & Appliances" },
            ].map((item) => (
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
      </aside>

      {/* Main Settings Content */}
      <div className="lg:col-span-9">
        {activeTab === "location" && (
          <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Local Air Quality Monitoring City
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Active telemetry: {selectedCity.name} ({selectedCity.region}) ·{" "}
                  <span className="font-mono">
                    {selectedCity.lat.toFixed(2)}, {selectedCity.lon.toFixed(2)}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleUseMyLocation}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                <LocateFixed className="h-3.5 w-3.5 text-teal-700" />
                Use My GPS Coordinates
              </button>
            </div>

            {geoStatus && <p className="text-xs text-slate-600">{geoStatus}</p>}

            {/* Live Global City Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-3">
              <div className="relative flex-1">
                <label htmlFor="city-search-input" className="sr-only">
                  Search any city worldwide
                </label>
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  id="city-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search any city worldwide (e.g., Tokyo, Paris, Chicago, Lahore)..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-700 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={searching || searchQuery.trim().length < 2}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            {searchError && <p className="text-xs text-red-600">{searchError}</p>}

            {searchResults.length > 0 && (
              <div>
                <div className="pb-2 text-xs font-medium text-slate-500">Search Results</div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {searchResults.map((city) => (
                    <li key={city.id}>
                      <button
                        type="button"
                        onClick={() => onSelectCity(city)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{city.name}</span>
                          <span className="ml-2 text-xs text-slate-500">{city.region}</span>
                        </div>
                        <span className="font-mono text-xs text-teal-700">Select</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="pb-2 text-xs font-medium text-slate-500">
                High-Density Urban Presets
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {PRESET_CITIES.map((city) => {
                  const isCurrent = city.id === selectedCity.id;
                  return (
                    <li key={city.id}>
                      <button
                        type="button"
                        onClick={() => onSelectCity(city)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                          isCurrent ? "bg-teal-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <span className="font-medium text-slate-900">{city.name}</span>
                          <span className="ml-2 text-xs text-slate-500">{city.region}</span>
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            isCurrent ? "text-teal-800 font-semibold" : "text-slate-500"
                          }`}
                        >
                          {isCurrent ? "Active City" : "Switch"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "members" && (
          <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Household Members & Respiratory Sensitivities
              </h2>
              <p className="mt-1 text-xs text-slate-500">
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
                      <span className="font-normal text-xs text-slate-500">· {m.ageGroup}</span>
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
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-teal-700"
                    >
                      <Trash2 className="h-4 w-4" />
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
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
                <div className="pb-1.5 text-xs text-slate-600">Sensitivities</div>
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
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Member
              </button>
            </form>
          </section>
        )}

        {activeTab === "home" && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Home Environment & Commute Baseline
              </h2>
              <p className="mt-1 text-xs text-slate-500">
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
                  Primary School & Work Commute
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
        )}
      </div>
    </div>
  );
};
