import React, { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Home,
  Leaf,
  MapPin,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { PRESET_CITIES } from "../data/knowledgeBase";
import { CityLocation, LocalAirQualityData, NavSection } from "../types";
import { getSeverityStyle } from "../utils/healthCalculations";

interface VerticalSidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  selectedCity: CityLocation;
  onSelectCity: (city: CityLocation) => void;
  airQuality: LocalAirQualityData | null;
  loadingAq: boolean;
  onRefreshAq: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenQuickChat: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "overview",
    label: "Overview & Health",
    sublabel: "Long-term exposure trends",
    icon: Activity,
  },
  {
    id: "routines",
    label: "Low-Emission Routines",
    sublabel: "Tailored daily schedule",
    icon: Clock,
  },
  {
    id: "hacks",
    label: "Indoor Air Hacks",
    sublabel: "Filtration & home sealing",
    icon: Home,
  },
  {
    id: "swaps",
    label: "Sustainable Swaps",
    sublabel: "Real-world impact ledger",
    icon: Leaf,
  },
  {
    id: "assistant",
    label: "Air Quality Assistant",
    sublabel: "GenAI family advisor",
    icon: Bot,
  },
  {
    id: "family",
    label: "Family & Location",
    sublabel: "Household & local sensor",
    icon: Users,
  },
];

export const VerticalSidebar: React.FC<VerticalSidebarProps> = ({
  activeSection,
  onSelectSection,
  selectedCity,
  onSelectCity,
  airQuality,
  loadingAq,
  onRefreshAq,
  mobileOpen,
  onCloseMobile,
  onOpenQuickChat,
}) => {
  const [cityMenuOpen, setCityMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  const severityStyle = airQuality
    ? getSeverityStyle(airQuality.current.severity)
    : getSeverityStyle("moderate");

  const handleNavClick = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      {/* Brand Wordmark */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            ClearAir
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Primary Vertical Navigation Menu */}
      <nav aria-label="Primary vertical navigation" className="flex-1 overflow-y-auto px-3 py-5">
        <div className="px-2.5 pb-2 text-xs font-medium text-slate-500">
          Workspace Menu
        </div>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    isActive
                      ? "bg-teal-50 text-teal-900"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      isActive ? "text-teal-700" : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm leading-tight whitespace-nowrap truncate ${
                        isActive ? "font-semibold text-teal-950" : "font-medium"
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 truncate">
                      {item.sublabel}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Vertical Local Air Switcher Menu */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between px-2.5 pb-2">
            <span className="text-xs font-medium text-slate-500">Monitoring Location</span>
            <button
              type="button"
              onClick={onRefreshAq}
              disabled={loadingAq}
              title="Refresh local telemetry"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingAq ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCityMenuOpen((prev) => !prev)}
            aria-expanded={cityMenuOpen}
            aria-controls="monitoring-city-menu"
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                <span className="truncate">{selectedCity.name}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-mono font-semibold tabular-nums">
                  {airQuality ? `AQI ${airQuality.current.usAqi}` : "Loading..."}
                </span>
                <span aria-hidden="true">·</span>
                <span className={`font-medium ${severityStyle.text}`}>
                  {airQuality ? airQuality.current.category : "Syncing"}
                </span>
              </div>
            </div>
            {cityMenuOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
            )}
          </button>

          {/* Vertical expandable city list */}
          {cityMenuOpen && (
            <ul id="monitoring-city-menu" className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
              {PRESET_CITIES.map((city) => {
                const isSelected = city.id === selectedCity.id;
                return (
                  <li key={city.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCity(city);
                        setCityMenuOpen(false);
                      }}
                      aria-current={isSelected ? "true" : undefined}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                        isSelected
                          ? "bg-teal-50 font-semibold text-teal-900"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate">{city.name}</span>
                      <span className="text-slate-500 ml-2 shrink-0">{city.country}</span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setCityMenuOpen(false);
                    handleNavClick("family");
                  }}
                  className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-teal-700 hover:bg-teal-50"
                >
                  Search any global city...
                </button>
              </li>
            </ul>
          )}

          {/* Vertical Quick AI Chat Trigger */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onOpenQuickChat();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg border border-teal-200 bg-teal-50/70 px-3 py-2.5 text-left text-xs font-semibold text-teal-900 transition-colors hover:bg-teal-100/80"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-teal-700" />
              <span>Open Live AI Chat</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop fixed vertical sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0">{sidebarContent}</aside>

      {/* Mobile slide-over vertical drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
