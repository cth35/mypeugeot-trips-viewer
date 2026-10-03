import { useEffect, useState } from "react";
import { getRecords } from "../api.js";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function RecordCard({ label, trip, value, accent, onSelect }) {
  if (!trip) {
    return (
      <div className="rounded-md border border-graphite-600 bg-graphite-800 p-3">
        <div className="text-xs uppercase tracking-wide text-mist-500">{label}</div>
        <div className="mt-2 text-sm text-mist-500">—</div>
      </div>
    );
  }
  return (
    <button
      onClick={() => onSelect(trip)}
      className="rounded-md border border-graphite-600 bg-graphite-800 p-3 text-left transition-colors hover:border-cobalt-500/60"
    >
      <div className={`text-xs uppercase tracking-wide ${accent}`}>{label}</div>
      <div className="num mt-1 text-xl font-semibold text-mist-100">{value}</div>
      <div className="mt-1 truncate text-xs text-mist-500">
        {trip.start_city || "?"} → {trip.end_city || "?"} · {fmtDate(trip.start_date)}
      </div>
    </button>
  );
}

export default function RecordsPanel({ filters, onSelectTrip }) {
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRecords(filters)
      .then((data) => !cancelled && setRecords(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="rounded-md border border-graphite-600 bg-graphite-800 p-4">
      <div className="mb-3 text-xs uppercase tracking-wide text-mist-500">Records</div>
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-mist-500">Chargement…</div>
      ) : !records ? (
        <div className="flex h-40 items-center justify-center text-sm text-mist-500">Aucune donnée.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          <RecordCard
            label="Plus long trajet"
            trip={records.longest_distance}
            value={records.longest_distance ? `${records.longest_distance.distance_km.toFixed(1)} km` : "—"}
            accent="text-cobalt-400"
            onSelect={onSelectTrip}
          />
          <RecordCard
            label="Plus cher"
            trip={records.priciest}
            value={records.priciest ? `${records.priciest.cost.toFixed(2)} €` : "—"}
            accent="text-amber-400"
            onSelect={onSelectTrip}
          />
          <RecordCard
            label="Conso. la + élevée"
            trip={records.highest_consumption}
            value={
              records.highest_consumption
                ? `${records.highest_consumption.consumption_l_100km.toFixed(1)} L/100km`
                : "—"
            }
            accent="text-red-400"
            onSelect={onSelectTrip}
          />
          <RecordCard
            label="Conso. la + basse"
            trip={records.lowest_consumption}
            value={
              records.lowest_consumption
                ? `${records.lowest_consumption.consumption_l_100km.toFixed(1)} L/100km`
                : "—"
            }
            accent="text-emerald-400"
            onSelect={onSelectTrip}
          />
          <RecordCard
            label="Vitesse moy. la + élevée"
            trip={records.fastest_avg_speed}
            value={records.fastest_avg_speed_kmh ? `${records.fastest_avg_speed_kmh.toFixed(0)} km/h` : "—"}
            accent="text-cobalt-400"
            onSelect={onSelectTrip}
          />
        </div>
      )}
    </div>
  );
}
