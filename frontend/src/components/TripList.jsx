import { useRef, useEffect } from "react";

function fmtDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(seconds) {
  if (seconds == null) return "inconnue";
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h ? `${h} h ${rem.toString().padStart(2, "0")}` : `${m} min`;
}

export default function TripList({
  trips,
  loading,
  search,
  onSearch,
  selectedId,
  onSelect,
  pinnedTrip,
}) {
  const itemRefs = useRef(new Map());

  useEffect(() => {
    if (selectedId == null) return;
    const el = itemRefs.current.get(selectedId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId, trips, pinnedTrip]);

  function setItemRef(id) {
    return (el) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    };
  }

  function Row({ t, pinned }) {
    return (
      <li key={t.id} ref={setItemRef(t.id)}>
        <button
          onClick={() => onSelect(t)}
          className={`block w-full px-4 py-3 text-left transition-colors ${
            selectedId === t.id ? "bg-cobalt-500/15" : "hover:bg-graphite-700/60"
          } ${pinned ? "bg-graphite-700/50" : ""}`}
        >
          {pinned && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-cobalt-400">
              Trajet sélectionné (hors page actuelle)
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-mist-100">
              {t.start_city || "?"} → {t.end_city || "?"}
            </span>
            <span className="num shrink-0 text-mist-500">{fmtDate(t.start_date)}</span>
          </div>
          <div className="num mt-1 grid grid-cols-[58px_60px_86px_58px_82px] gap-x-2 text-xs text-mist-500">
            <span className="text-right">{t.distance_km.toFixed(1)} km</span>
            <span className="text-right">{fmtDuration(t.travel_time_s)}</span>
            <span className="text-right">
              {t.consumption_l_100km != null ? `${t.consumption_l_100km.toFixed(1)} L/100km` : "—"}
            </span>
            <span className="text-right text-amber-400">
              {t.cost != null ? `${t.cost.toFixed(2)} €` : "—"}
            </span>
            <span className="text-right text-amber-400/70">
              {t.cost_per_km != null ? `${t.cost_per_km.toFixed(3)} €/km` : "—"}
            </span>
          </div>
        </button>
      </li>
    );
  }

  const showPinned = pinnedTrip && !trips.some((t) => t.id === pinnedTrip.id);

  return (
    <div className="flex h-full flex-col rounded-md border border-graphite-600 bg-graphite-800">
      <div className="border-b border-graphite-600 p-3">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filtrer par ville…"
          className="w-full rounded border border-graphite-600 bg-graphite-900 px-3 py-1.5 text-sm text-mist-100 placeholder:text-mist-500 focus:border-cobalt-500 focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-mist-500">Chargement…</div>
        ) : trips.length === 0 && !showPinned ? (
          <div className="p-4 text-sm text-mist-500">Aucun trajet trouvé.</div>
        ) : (
          <ul className="divide-y divide-graphite-700">
            {showPinned && <Row t={pinnedTrip} pinned />}
            {trips.map((t) => (
              <Row key={t.id} t={t} pinned={false} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
