import { useEffect, useMemo, useState, useCallback } from "react";
import { getVehicles, getTrips, getStats, deleteAllTrips } from "./api.js";
import ImportPanel from "./components/ImportPanel.jsx";
import PeriodSelector from "./components/PeriodSelector.jsx";
import QuickRangeSelector from "./components/QuickRangeSelector.jsx";
import StatsDashboard from "./components/StatsDashboard.jsx";
import TripList from "./components/TripList.jsx";
import TripMap from "./components/TripMap.jsx";
import HeatMap from "./components/HeatMap.jsx";
import RecurringRoutes from "./components/RecurringRoutes.jsx";
import RecordsPanel from "./components/RecordsPanel.jsx";

export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [vin, setVin] = useState("");
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickRange, setQuickRange] = useState(null);
  const [search, setSearch] = useState("");

  const [trips, setTrips] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [mapView, setMapView] = useState("trip"); // "trip" | "heat"
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo(
    () => ({ vin: vin || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
    [vin, dateFrom, dateTo]
  );

  const loadVehicles = useCallback(async () => {
    const v = await getVehicles();
    setVehicles(v);
  }, []);

  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    try {
      const data = await getTrips({ ...filters, q: search || undefined });
      setTrips(data);
    } finally {
      setTripsLoading(false);
    }
  }, [filters, search]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getStats({ ...filters, period });
      setBuckets(data);
    } finally {
      setStatsLoading(false);
    }
  }, [filters, period]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles, refreshKey]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips, refreshKey]);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  useEffect(() => {
    setSelectedTrip(null);
  }, [vin, dateFrom, dateTo]);

  async function handleReset() {
    if (!confirm("Supprimer toutes les données importées ?")) return;
    await deleteAllTrips();
    setSelectedTrip(null);
    setRefreshKey((k) => k + 1);
  }

  function selectTripAndShowMap(trip) {
    setSelectedTrip(trip);
    setMapView("trip");
  }

  function applyQuickRange(range) {
    const to = new Date();
    const from = new Date(to.getTime() - range.hours * 3600 * 1000);
    setDateFrom(from.toISOString());
    setDateTo("");
    setQuickRange(range.key);
    setPeriod(range.period);
  }

  function clearQuickRange() {
    setDateFrom("");
    setDateTo("");
    setQuickRange(null);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-mist-100">Trajets</h1>
          <p className="text-sm text-mist-500">Tableau de bord des trajets Peugeot</p>
        </div>
        <ImportPanel onImported={() => setRefreshKey((k) => k + 1)} />
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <QuickRangeSelector active={quickRange} onSelect={applyQuickRange} onClear={clearQuickRange} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />

        <select
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          className="rounded-md border border-graphite-600 bg-graphite-800 px-3 py-1.5 text-sm text-mist-100 focus:border-cobalt-500 focus:outline-none"
        >
          <option value="">Tous les véhicules</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.vin}>
              {v.label || v.vin}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom ? dateFrom.slice(0, 10) : ""}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setQuickRange(null);
          }}
          className="rounded-md border border-graphite-600 bg-graphite-800 px-3 py-1.5 text-sm text-mist-100 focus:border-cobalt-500 focus:outline-none [color-scheme:dark]"
        />
        <span className="text-mist-500">→</span>
        <input
          type="date"
          value={dateTo ? dateTo.slice(0, 10) : ""}
          onChange={(e) => {
            setDateTo(e.target.value);
            setQuickRange(null);
          }}
          className="rounded-md border border-graphite-600 bg-graphite-800 px-3 py-1.5 text-sm text-mist-100 focus:border-cobalt-500 focus:outline-none [color-scheme:dark]"
        />

        {(dateFrom || dateTo || vin) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setQuickRange(null);
              setVin("");
            }}
            className="text-sm text-mist-500 hover:text-mist-100"
          >
            Réinitialiser les filtres
          </button>
        )}

        <button
          onClick={handleReset}
          className="ml-auto text-sm text-mist-500 hover:text-red-400"
        >
          Effacer les données
        </button>
      </div>

      <StatsDashboard buckets={buckets} loading={statsLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecurringRoutes filters={filters} />
        <RecordsPanel filters={filters} onSelectTrip={selectTripAndShowMap} />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-[540px] lg:col-span-2">
          <TripList
            trips={trips}
            loading={tripsLoading}
            search={search}
            onSearch={setSearch}
            selectedId={selectedTrip?.id}
            onSelect={selectTripAndShowMap}
            pinnedTrip={selectedTrip}
          />
        </div>
        <div className="h-[540px] lg:col-span-3">
          <div className="mb-2 flex justify-end">
            <div className="inline-flex rounded-md border border-graphite-600 bg-graphite-800 p-0.5">
              <button
                onClick={() => setMapView("trip")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  mapView === "trip" ? "bg-cobalt-500 text-white" : "text-mist-300 hover:text-mist-100"
                }`}
              >
                Trajet sélectionné
              </button>
              <button
                onClick={() => setMapView("heat")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  mapView === "heat" ? "bg-cobalt-500 text-white" : "text-mist-300 hover:text-mist-100"
                }`}
              >
                Carte de chaleur
              </button>
            </div>
          </div>
          <div className="h-[500px]">
            {mapView === "trip" ? <TripMap trip={selectedTrip} /> : <HeatMap filters={filters} />}
          </div>
        </div>
      </div>

      <footer className="pb-4 text-center text-xs text-mist-500">
        Fond de carte © contributeurs OpenStreetMap · Itinéraires estimés via OSRM
      </footer>
    </div>
  );
}
