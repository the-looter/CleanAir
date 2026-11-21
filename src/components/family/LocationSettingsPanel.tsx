import React, { useState } from "react";
import { LocateFixed, Search } from "lucide-react";
import { PRESET_CITIES } from "../../data/knowledgeBase";
import { searchCities } from "../../services/api";
import { CityLocation } from "../../types";

interface LocationSettingsPanelProps {
  selectedCity: CityLocation;
  onSelectCity: (city: CityLocation) => void;
}

export const LocationSettingsPanel: React.FC<LocationSettingsPanelProps> = ({
  selectedCity,
  onSelectCity,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CityLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

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

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Local Air Quality Monitoring City
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Active telemetry: {selectedCity.name} ({selectedCity.region}) ·{" "}
            <span className="font-mono">
              {selectedCity.lat.toFixed(2)}, {selectedCity.lon.toFixed(2)}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseMyLocation}
          className="min-h-[40px] flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <LocateFixed className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
          Use My GPS Coordinates
        </button>
      </div>

      {geoStatus && (
        <p role="status" aria-live="polite" className="text-xs text-slate-700">
          {geoStatus}
        </p>
      )}

      {/* Live Global City Search */}
      <form onSubmit={handleSearch} className="flex items-center gap-3">
        <div className="relative flex-1">
          <label htmlFor="city-search-input" className="sr-only">
            Search any city worldwide
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-600"
            aria-hidden="true"
          />
          <input
            id="city-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any city worldwide (e.g., Tokyo, Paris, Chicago, Lahore)..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-600 focus:border-teal-700 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching || searchQuery.trim().length < 2}
          className="min-h-[40px] rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {searchError && (
        <p role="alert" className="text-xs text-red-700">
          {searchError}
        </p>
      )}

      {searchResults.length > 0 && (
        <div>
          <div className="pb-2 text-xs font-medium text-slate-600">Search Results</div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {searchResults.map((city) => (
              <li key={city.id}>
                <button
                  type="button"
                  onClick={() => onSelectCity(city)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{city.name}</span>
                    <span className="ml-2 text-xs text-slate-600">{city.region}</span>
                  </div>
                  <span className="font-mono text-xs font-medium text-teal-800">Select</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="pb-2 text-xs font-medium text-slate-600">
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
                  aria-pressed={isCurrent}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    isCurrent ? "bg-teal-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <span className="font-medium text-slate-900">{city.name}</span>
                    <span className="ml-2 text-xs text-slate-600">{city.region}</span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isCurrent ? "text-teal-800 font-semibold" : "text-slate-600"
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
  );
};
