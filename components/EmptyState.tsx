"use client";

import { colorForCategory } from "@/lib/colors";

interface Props {
  topCategories: { name: string; count: number }[];
  onPickCategory: (name: string) => void;
}

export default function EmptyState({ topCategories, onPickCategory }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm text-white/50">
        Pick a category or location above, or search a name, to browse a slice of the landscape.
      </p>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {topCategories.map((c) => (
          <button
            key={c.name}
            onClick={() => onPickCategory(c.name)}
            className="flex items-center gap-1.5 border-b border-transparent pb-0.5 text-xs text-white/70 hover:border-white/30 hover:text-white"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: colorForCategory(c.name) }} />
            {c.name}
            <span className="font-mono text-parchment/50">{c.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// EmptyState renders *inside* the dark graph canvas (not the white page
// chrome), so it deliberately keeps the light-on-dark text treatment.
