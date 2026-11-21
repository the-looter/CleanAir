import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { HealthLogEntry } from "../types";

interface CheckInModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: HealthLogEntry) => void;
  defaultDate: string;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  open,
  onClose,
  onSave,
  defaultDate,
}) => {
  const [date, setDate] = useState(defaultDate);
  const [symptomScore, setSymptomScore] = useState(4);
  const [sleepQuality, setSleepQuality] = useState(4);
  const [outdoorMinutes, setOutdoorMinutes] = useState(30);
  const [routineFollowed, setRoutineFollowed] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, defaultDate, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date,
      symptomScore,
      sleepQuality,
      outdoorMinutes,
      routineFollowed,
      notes: notes.trim() || (routineFollowed ? "Followed low-emission routine" : "High exposure day"),
      isUserLogged: true,
    });
    setNotes("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 id="checkin-modal-title" className="font-display text-lg font-semibold text-slate-900">
            Log Family Breathing Check-In
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="checkin-date" className="block text-xs font-medium text-slate-700">
              Date
            </label>
            <input
              id="checkin-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span id="comfort-score-label" className="text-xs font-medium text-slate-700">
                Respiratory Comfort Score (1 = wheeze/cough, 5 = clear)
              </span>
              <span className="font-mono text-xs font-semibold text-teal-800">{symptomScore} / 5</span>
            </div>
            <div
              role="group"
              aria-labelledby="comfort-score-label"
              className="mt-2 flex flex-col gap-1.5"
            >
              {[
                { val: 5, label: "5 — Clear breathing, zero nasal or throat irritation" },
                { val: 4, label: "4 — Comfortable overall, minor morning dryness" },
                { val: 3, label: "3 — Noticeable congestion or mild cough outdoors" },
                { val: 2, label: "2 — Frequent coughing, wheezing, or eye irritation" },
                { val: 1, label: "1 — Severe respiratory discomfort / rescue inhaler needed" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSymptomScore(opt.val)}
                  aria-pressed={symptomScore === opt.val}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    symptomScore === opt.val
                      ? "border-teal-700 bg-teal-50 font-medium text-teal-950"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sleep-quality" className="block text-xs font-medium text-slate-700">
                Sleep Quality (1–5)
              </label>
              <input
                id="sleep-quality"
                type="number"
                min={1}
                max={5}
                value={sleepQuality}
                onChange={(e) => setSleepQuality(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="outdoor-mins" className="block text-xs font-medium text-slate-700">
                Outdoor Minutes
              </label>
              <input
                id="outdoor-mins"
                type="number"
                min={0}
                max={600}
                value={outdoorMinutes}
                onChange={(e) => setOutdoorMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={routineFollowed}
              onChange={(e) => setRoutineFollowed(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
            />
            <span>Followed low-emission routine & indoor purifier schedule</span>
          </label>

          <div>
            <label htmlFor="checkin-notes" className="block text-xs font-medium text-slate-700">
              Notes (optional)
            </label>
            <textarea
              id="checkin-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Ran Corsi-Rosenthal box overnight, kids felt energized at school drop-off"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Save Check-In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
