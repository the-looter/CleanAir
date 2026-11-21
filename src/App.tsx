import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { CheckInModal } from "./components/CheckInModal";
import { OverviewDashboard } from "./components/OverviewDashboard";
import { VerticalSidebar } from "./components/VerticalSidebar";

const AssistantView = lazy(() =>
  import("./components/AssistantView").then((m) => ({ default: m.AssistantView }))
);
const FamilyLocationView = lazy(() =>
  import("./components/FamilyLocationView").then((m) => ({ default: m.FamilyLocationView }))
);
const IndoorHacksView = lazy(() =>
  import("./components/IndoorHacksView").then((m) => ({ default: m.IndoorHacksView }))
);
const QuickChatDrawer = lazy(() =>
  import("./components/QuickChatDrawer").then((m) => ({ default: m.QuickChatDrawer }))
);
const RoutinesView = lazy(() =>
  import("./components/RoutinesView").then((m) => ({ default: m.RoutinesView }))
);
const SustainableSwapsView = lazy(() =>
  import("./components/SustainableSwapsView").then((m) => ({ default: m.SustainableSwapsView }))
);
import { DEFAULT_FAMILY_PROFILE, PRESET_CITIES } from "./data/knowledgeBase";
import { fetchLocalAirQuality } from "./services/api";
import {
  ChatMessage,
  CityLocation,
  FamilyProfile,
  HealthLogEntry,
  LocalAirQualityData,
  NavSection,
  RoutinePlan,
} from "./types";

const SECTION_LABELS: Record<NavSection, string> = {
  overview: "Overview & Health",
  routines: "Low-Emission Routines",
  hacks: "Indoor Air Hacks",
  swaps: "Sustainable Swaps",
  assistant: "Air Quality Assistant",
  family: "Family & Location",
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [quickChatOpen, setQuickChatOpen] = useState(false);

  const [selectedCity, setSelectedCity] = useState<CityLocation>(() =>
    readStorage("clearair_city_v1", PRESET_CITIES[0])
  );
  const [familyProfile, setFamilyProfile] = useState<FamilyProfile>(() =>
    readStorage("clearair_profile_v1", DEFAULT_FAMILY_PROFILE)
  );
  const [activeHackIds, setActiveHackIds] = useState<string[]>(() =>
    readStorage("clearair_hacks_v1", ["corsi-rosenthal-diy", "kitchen-capture-hood"])
  );
  const [adoptedSwapIds, setAdoptedSwapIds] = useState<string[]>(() =>
    readStorage("clearair_swaps_v1", ["portable-induction-hob", "fragrance-free-castile"])
  );
  const [healthLogs, setHealthLogs] = useState<HealthLogEntry[]>(() =>
    readStorage("clearair_health_logs_v1", [])
  );
  const [completedStepKeys, setCompletedStepKeys] = useState<string[]>(() =>
    readStorage("clearair_routine_steps_v1", [])
  );

  const [airQuality, setAirQuality] = useState<LocalAirQualityData | null>(null);
  const [loadingAq, setLoadingAq] = useState(false);
  const [aqError, setAqError] = useState<string | null>(null);
  const [routinePlan, setRoutinePlan] = useState<RoutinePlan | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    localStorage.setItem("clearair_city_v1", JSON.stringify(selectedCity));
  }, [selectedCity]);

  useEffect(() => {
    localStorage.setItem("clearair_profile_v1", JSON.stringify(familyProfile));
  }, [familyProfile]);

  useEffect(() => {
    localStorage.setItem("clearair_hacks_v1", JSON.stringify(activeHackIds));
  }, [activeHackIds]);

  useEffect(() => {
    localStorage.setItem("clearair_swaps_v1", JSON.stringify(adoptedSwapIds));
  }, [adoptedSwapIds]);

  useEffect(() => {
    localStorage.setItem("clearair_health_logs_v1", JSON.stringify(healthLogs));
  }, [healthLogs]);

  useEffect(() => {
    localStorage.setItem("clearair_routine_steps_v1", JSON.stringify(completedStepKeys));
  }, [completedStepKeys]);

  const loadAirQuality = useCallback(async () => {
    setLoadingAq(true);
    setAqError(null);
    try {
      const data = await fetchLocalAirQuality(selectedCity.lat, selectedCity.lon);
      setAirQuality(data);
    } catch (err) {
      setAqError(err instanceof Error ? err.message : "Failed to fetch local air quality.");
    } finally {
      setLoadingAq(false);
    }
  }, [selectedCity.lat, selectedCity.lon]);

  useEffect(() => {
    void loadAirQuality();
    const timer = window.setInterval(() => {
      void loadAirQuality();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadAirQuality]);

  const handleToggleHack = useCallback((hackId: string) => {
    setActiveHackIds((prev) =>
      prev.includes(hackId) ? prev.filter((id) => id !== hackId) : [...prev, hackId]
    );
  }, []);

  const handleToggleSwap = useCallback((swapId: string) => {
    setAdoptedSwapIds((prev) =>
      prev.includes(swapId) ? prev.filter((id) => id !== swapId) : [...prev, swapId]
    );
  }, []);

  const handleSaveCheckIn = useCallback((entry: HealthLogEntry) => {
    setHealthLogs((prev) => {
      const filtered = prev.filter((l) => l.date !== entry.date);
      return [...filtered, entry];
    });
  }, []);

  const handleToggleStep = useCallback((stepKey: string) => {
    setCompletedStepKeys((prev) =>
      prev.includes(stepKey) ? prev.filter((k) => k !== stepKey) : [...prev, stepKey]
    );
  }, []);

  const handleAddMessages = useCallback((msgs: ChatMessage[]) => {
    setChatMessages((prev) => [...prev, ...msgs]);
  }, []);

  const handleUpdateMessage = useCallback((id: string, text: string) => {
    setChatMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
  }, []);

  const handleRemoveMessage = useCallback((id: string) => {
    setChatMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleClearMessages = useCallback(() => {
    setChatMessages([]);
  }, []);

  const todayStr =
    airQuality?.observedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <VerticalSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        airQuality={airQuality}
        loadingAq={loadingAq}
        onRefreshAq={() => void loadAirQuality()}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenQuickChat={() => setQuickChatOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action button on right */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open vertical navigation menu"
              aria-expanded={mobileMenuOpen}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 text-sm whitespace-nowrap truncate">
              <span className="font-medium text-slate-600">ClearAir</span>
              <span className="text-slate-600" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">
                {SECTION_LABELS[activeSection]}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="min-h-[40px] rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
          >
            Log Daily Check-In
          </button>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-8 focus:outline-none">
          <Suspense
            fallback={
              <div className="space-y-4" aria-busy="true" aria-label="Loading section">
                <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
                <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
              </div>
            }
          >
          {activeSection === "overview" && (
            <OverviewDashboard
              selectedCity={selectedCity}
              airQuality={airQuality}
              loadingAq={loadingAq}
              aqError={aqError}
              onRetryAq={() => void loadAirQuality()}
              familyProfile={familyProfile}
              activeHackIds={activeHackIds}
              adoptedSwapIds={adoptedSwapIds}
              healthLogs={healthLogs}
              onOpenCheckIn={() => setCheckInOpen(true)}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === "routines" && (
            <RoutinesView
              selectedCity={selectedCity}
              airQuality={airQuality}
              familyProfile={familyProfile}
              activeHackIds={activeHackIds}
              adoptedSwapIds={adoptedSwapIds}
              routinePlan={routinePlan}
              onUpdateRoutinePlan={setRoutinePlan}
              completedStepKeys={completedStepKeys}
              onToggleStep={handleToggleStep}
            />
          )}

          {activeSection === "hacks" && (
            <IndoorHacksView
              selectedCity={selectedCity}
              airQuality={airQuality}
              familyProfile={familyProfile}
              activeHackIds={activeHackIds}
              onToggleHack={handleToggleHack}
            />
          )}

          {activeSection === "swaps" && (
            <SustainableSwapsView
              selectedCity={selectedCity}
              airQuality={airQuality}
              familyProfile={familyProfile}
              adoptedSwapIds={adoptedSwapIds}
              onToggleSwap={handleToggleSwap}
            />
          )}

          {activeSection === "assistant" && (
            <AssistantView
              selectedCity={selectedCity}
              airQuality={airQuality}
              familyProfile={familyProfile}
              activeHackIds={activeHackIds}
              adoptedSwapIds={adoptedSwapIds}
              messages={chatMessages}
              onAddMessages={handleAddMessages}
              onUpdateMessage={handleUpdateMessage}
              onRemoveMessage={handleRemoveMessage}
              onClearMessages={handleClearMessages}
            />
          )}

          {activeSection === "family" && (
            <FamilyLocationView
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              familyProfile={familyProfile}
              onUpdateProfile={setFamilyProfile}
            />
          )}
          </Suspense>
        </main>
      </div>

      <CheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSave={handleSaveCheckIn}
        defaultDate={todayStr}
      />

      <Suspense fallback={null}>
        <QuickChatDrawer
          open={quickChatOpen}
          onClose={() => setQuickChatOpen(false)}
          selectedCity={selectedCity}
          airQuality={airQuality}
          familyProfile={familyProfile}
          activeHackIds={activeHackIds}
          adoptedSwapIds={adoptedSwapIds}
          messages={chatMessages}
          onAddMessages={handleAddMessages}
          onUpdateMessage={handleUpdateMessage}
          onRemoveMessage={handleRemoveMessage}
        />
      </Suspense>
    </div>
  );
}
