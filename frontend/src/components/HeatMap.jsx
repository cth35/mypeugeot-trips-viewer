import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { getHeatmap } from "../api.js";
import CtrlScrollZoom from "./CtrlScrollZoom.jsx";

function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const layer = L.heatLayer(
      points.map((p) => [p.lat, p.lon, 0.6]),
      { radius: 14, blur: 18, maxZoom: 14, gradient: { 0.2: "#2E5FD1", 0.5: "#5B8CFF", 0.8: "#F5A623", 1: "#F7B84B" } }
    );
    layer.addTo(map);

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32] });

    return () => {
      map.removeLayer(layer);
    };
  }, [points, map]);

  return null;
}

export default function HeatMap({ filters }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHeatmap(filters)
      .then((data) => !cancelled && setPoints(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-md border border-graphite-600">
      <div className="relative flex-1">
        <MapContainer
          center={[48.15, -1.9]}
          zoom={9}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <HeatLayer points={points} />
          <CtrlScrollZoom />
        </MapContainer>
      </div>
      <div className="border-t border-graphite-600 bg-graphite-800 px-3 py-1.5 text-xs text-mist-500">
        {loading
          ? "Chargement des zones parcourues…"
          : `${points.length.toLocaleString("fr-FR")} points de départ/arrivée cumulés`}
      </div>
    </div>
  );
}
