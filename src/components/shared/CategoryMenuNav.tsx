import React from "react";

interface CategoryMenuItem<T extends string> {
  value: T;
  count: number;
}

interface CategoryMenuNavProps<T extends string> {
  ariaLabel: string;
  heading: string;
  items: CategoryMenuItem<T>[];
  selected: T;
  onSelect: (value: T) => void;
  footer?: React.ReactNode;
}

export function CategoryMenuNav<T extends string>({
  ariaLabel,
  heading,
  items,
  selected,
  onSelect,
  footer,
}: CategoryMenuNavProps<T>) {
  return (
    <nav aria-label={ariaLabel} className="lg:col-span-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="px-2 pb-2 text-xs font-medium text-slate-600">{heading}</div>
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const isSelected = selected === item.value;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => onSelect(item.value)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    isSelected
                      ? "bg-teal-50 font-semibold text-teal-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate">{item.value}</span>
                  <span className="font-mono text-xs text-slate-600">{item.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {footer}
      </div>
    </nav>
  );
}
