'use client';

interface ChipOption<T> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string | number> {
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Tap-to-select buttons used instead of dropdowns. */
export function ChipGroup<T extends string | number>({ label, options, value, onChange, className = '' }: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60 ${
            value === o.value
              ? 'border-kame-yellow bg-kame-yellow text-navy-900'
              : 'border-white/20 bg-navy-900/40 text-white hover:border-kame-cyan'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const btn =
    'h-12 w-12 rounded-full border border-kame-blue/50 bg-navy-700 text-2xl font-bold transition hover:border-kame-cyan focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60 active:scale-90 disabled:opacity-40';
  return (
    <div role="group" aria-label={label} className="flex items-center gap-4">
      <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className="min-w-10 text-center text-2xl font-bold" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}
