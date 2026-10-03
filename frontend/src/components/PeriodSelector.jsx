const PERIODS = [
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
];

export default function PeriodSelector({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-graphite-600 bg-graphite-800 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            value === p.key
              ? "bg-cobalt-500 text-white"
              : "text-mist-300 hover:text-mist-100"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
