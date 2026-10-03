const RANGES = [
  { key: "24h", label: "Dernières 24h", hours: 24, period: "day" },
  { key: "72h", label: "Dernières 72h", hours: 72, period: "day" },
  { key: "7d", label: "7 derniers jours", hours: 24 * 7, period: "day" },
  { key: "30d", label: "30 derniers jours", hours: 24 * 30, period: "week" },
  { key: "3m", label: "3 derniers mois", hours: 24 * 90, period: "month" },
];

export default function QuickRangeSelector({ active, onSelect, onClear }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-graphite-600 bg-graphite-800 p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onSelect(r)}
          className={`rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
            active === r.key ? "bg-cobalt-500 text-white" : "text-mist-300 hover:text-mist-100"
          }`}
        >
          {r.label}
        </button>
      ))}
      <button
        onClick={onClear}
        className={`rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
          active === null ? "bg-cobalt-500 text-white" : "text-mist-300 hover:text-mist-100"
        }`}
      >
        Tout
      </button>
    </div>
  );
}
