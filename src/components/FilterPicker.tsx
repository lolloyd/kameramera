'use client';

import { FILTERS, type FilterId } from '@/lib/filters';

export default function FilterPicker({ value, onChange }: { value: FilterId; onChange: (id: FilterId) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
          className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60 ${
            value === f.id
              ? 'border-kame-yellow bg-kame-yellow text-navy-900'
              : 'border-white/20 bg-navy-900/40 text-white hover:border-kame-cyan'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
