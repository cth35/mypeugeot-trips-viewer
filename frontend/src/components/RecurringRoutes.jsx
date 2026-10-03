import { useEffect, useState } from "react";
import { getRecurringRoutes } from "../api.js";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

export default function RecurringRoutes({ filters }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRecurringRoutes({ ...filters, limit: 8 })
      .then((data) => !cancelled && setRoutes(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="rounded-md border border-graphite-600 bg-graphite-800 p-4">
      <div className="mb-3 text-xs uppercase tracking-wide text-mist-500">Trajets récurrents</div>
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-mist-500">Chargement…</div>
      ) : routes.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-center text-sm text-mist-500">
          Pas assez de trajets répétés détectés sur cette période.
        </div>
      ) : (
        <ul className="divide-y divide-graphite-700">
          {routes.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-mist-100">
                  {r.start_label} → {r.end_label}
                </div>
                <div className="num mt-0.5 text-xs text-mist-500">
                  {fmtDate(r.first_date)} → {fmtDate(r.last_date)} · {r.avg_distance_km.toFixed(1)} km
                  {r.avg_duration_min != null ? ` · ${Math.round(r.avg_duration_min)} min` : ""}
                  {r.avg_cost != null ? ` · ${r.avg_cost.toFixed(2)} € en moy.` : ""}
                </div>
              </div>
              <div className="num shrink-0 rounded bg-cobalt-500/15 px-2 py-1 text-xs font-semibold text-cobalt-400">
                {r.trip_count}×
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
