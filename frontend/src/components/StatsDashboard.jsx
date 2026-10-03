import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

function formatDuration(minutes) {
  if (!minutes || minutes < 0) minutes = 0;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

function Kpi({ label, value, unit, accent }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-graphite-600 bg-graphite-800 p-4">
      <div className={`absolute left-0 top-0 h-0.5 w-full ${accent}`} />
      <div className="text-xs uppercase tracking-wide text-mist-500">{label}</div>
      <div className="num mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold text-mist-100">{value}</span>
        {unit && <span className="text-sm text-mist-500">{unit}</span>}
      </div>
    </div>
  );
}

export default function StatsDashboard({ buckets, loading }) {
  const totals = buckets.reduce(
    (acc, b) => {
      acc.cost += b.cost;
      acc.distance += b.distance_km;
      acc.duration += b.duration_min;
      acc.tripCount += b.trip_count;
      acc.fuelWeightedConsumption += (b.avg_consumption_l_100km || 0) * b.distance_km;
      return acc;
    },
    { cost: 0, distance: 0, duration: 0, tripCount: 0, fuelWeightedConsumption: 0 }
  );
  const avgConsumption = totals.distance
    ? totals.fuelWeightedConsumption / totals.distance
    : null;
  const avgCostPerKm = totals.distance ? totals.cost / totals.distance : null;

  const chartData = buckets.map((b) => ({
    label: b.label,
    distance: b.distance_km,
    cost: b.cost,
    consumption: b.avg_consumption_l_100km,
    price: b.avg_fuel_price,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Nombre de trajets" value={fmt(totals.tripCount, 0)} accent="bg-mist-300" />
        <Kpi label="Coût carburant" value={fmt(totals.cost, 2)} unit="€" accent="bg-amber-500" />
        <Kpi
          label="Coût / km"
          value={fmt(avgCostPerKm, 3)}
          unit="€/km"
          accent="bg-amber-500"
        />
        <Kpi
          label="Conso. moyenne"
          value={fmt(avgConsumption, 2)}
          unit="L/100km"
          accent="bg-amber-400"
        />
        <Kpi label="Distance" value={fmt(totals.distance)} unit="km" accent="bg-cobalt-500" />
        <Kpi label="Durée cumulée" value={formatDuration(totals.duration)} accent="bg-cobalt-400" />
      </div>

      <div className="rounded-md border border-graphite-600 bg-graphite-800 p-4">
        <div className="mb-3 text-xs uppercase tracking-wide text-mist-500">
          Distance &amp; coût par période
        </div>
        {loading ? (
          <div className="flex h-64 items-center justify-center text-mist-500">Chargement…</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-mist-500">
            Aucune donnée pour cette période. Importez un export pour commencer.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="#242933" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#8B93A1"
                tick={{ fontSize: 12, fontFamily: "Inter" }}
                tickLine={false}
                axisLine={{ stroke: "#333A47" }}
              />
              <YAxis
                yAxisId="left"
                stroke="#5B8CFF"
                tick={{ fontSize: 12, fontFamily: "Inter" }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#F7B84B"
                tick={{ fontSize: 12, fontFamily: "Inter" }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: "#1B1F26",
                  border: "1px solid #333A47",
                  borderRadius: 6,
                  fontFamily: "Inter",
                  fontSize: 13,
                }}
                labelStyle={{ color: "#E7E9EC" }}
                formatter={(value, name) => {
                  if (name === "Distance") return [`${fmt(value)} km`, name];
                  if (name === "Coût") return [`${fmt(value, 2)} €`, name];
                  return [value, name];
                }}
              />
              <Bar yAxisId="left" dataKey="distance" name="Distance" fill="#3E7BFA" radius={[3, 3, 0, 0]} maxBarSize={36} />
              <Line
                yAxisId="right"
                dataKey="cost"
                name="Coût"
                stroke="#F5A623"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-md border border-graphite-600 bg-graphite-800 p-4">
        <div className="mb-3 text-xs uppercase tracking-wide text-mist-500">
          Prix moyen du carburant
        </div>
        {loading ? (
          <div className="flex h-52 items-center justify-center text-mist-500">Chargement…</div>
        ) : chartData.filter((d) => d.price != null).length === 0 ? (
          <div className="flex h-52 items-center justify-center text-mist-500">
            Pas de prix carburant disponible sur cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="#242933" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#8B93A1"
                tick={{ fontSize: 12, fontFamily: "Inter" }}
                tickLine={false}
                axisLine={{ stroke: "#333A47" }}
              />
              <YAxis
                stroke="#F7B84B"
                tick={{ fontSize: 12, fontFamily: "Inter" }}
                tickLine={false}
                axisLine={false}
                width={56}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1B1F26",
                  border: "1px solid #333A47",
                  borderRadius: 6,
                  fontFamily: "Inter",
                  fontSize: 13,
                }}
                labelStyle={{ color: "#E7E9EC" }}
                formatter={(value) => [`${fmt(value, 3)} €/L`, "Prix moyen"]}
              />
              <Line
                dataKey="price"
                name="Prix moyen"
                stroke="#F5A623"
                strokeWidth={2}
                dot={{ r: 3, fill: "#F5A623", strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
