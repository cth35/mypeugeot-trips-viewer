import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import CtrlScrollZoom from "./CtrlScrollZoom.jsx";
import { geocodeAddress } from "../api.js";

function makeIcon(color, approx) {
  const html = approx
    ? `<div style="width:12px;height:12px;border-radius:50%;background:${color}40;border:2px dashed ${color}"></div>`
    : `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #14171C;box-shadow:0 0 0 2px ${color}55"></div>`;
  return new L.DivIcon({ className: "", html, iconSize: [12, 12] });
}

const startIcon = makeIcon("#5B8CFF", false);
const startIconApprox = makeIcon("#5B8CFF", true);
const endIcon = makeIcon("#F5A623", false);
const endIconApprox = makeIcon("#F5A623", true);

// Mirrors the backend's `valid_coord`: filters out the sentinel values seen
// in the export (-1/-1 for "no GPS fix yet", 0/0 for an empty placeholder).
function isValidCoord(lat, lon) {
  return (
    lat != null &&
    lon != null &&
    !(lat === -1 && lon === -1) &&
    !(lat === 0 && lon === 0) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [32, 32] });
    } else if (points.length === 1) {
      map.setView(points[0], 12);
    }
  }, [points, map]);
  return null;
}

export default function TripMap({ trip }) {
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState(false);
  const [geoStart, setGeoStart] = useState(null);
  const [geoEnd, setGeoEnd] = useState(null);
  const [geoStartLoading, setGeoStartLoading] = useState(false);
  const [geoEndLoading, setGeoEndLoading] = useState(false);

  const startValid = trip && isValidCoord(trip.start_lat, trip.start_lon);
  const endValid = trip && isValidCoord(trip.end_lat, trip.end_lon);

  // GPS missing -> try to resolve an approximate position from the street
  // address instead (Nominatim/OpenStreetMap geocoding, cached server-side).
  useEffect(() => {
    setGeoStart(null);
    setGeoEnd(null);
    setGeoStartLoading(false);
    setGeoEndLoading(false);
    if (!trip) return;
    let cancelled = false;

    if (!startValid && (trip.start_street || trip.start_city)) {
      setGeoStartLoading(true);
      geocodeAddress({
        street: trip.start_street,
        city: trip.start_city,
        postal_code: trip.start_postal_code,
        country: trip.start_country,
      })
        .then((res) => !cancelled && setGeoStart(res))
        .catch(() => {})
        .finally(() => !cancelled && setGeoStartLoading(false));
    }

    if (!endValid && (trip.end_street || trip.end_city)) {
      setGeoEndLoading(true);
      geocodeAddress({
        street: trip.end_street,
        city: trip.end_city,
        postal_code: trip.end_postal_code,
        country: trip.end_country,
      })
        .then((res) => !cancelled && setGeoEnd(res))
        .catch(() => {})
        .finally(() => !cancelled && setGeoEndLoading(false));
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id]);

  const startPoint = startValid ? [trip.start_lat, trip.start_lon] : geoStart ? [geoStart.lat, geoStart.lon] : null;
  const endPoint = endValid ? [trip.end_lat, trip.end_lon] : geoEnd ? [geoEnd.lat, geoEnd.lon] : null;
  const startApprox = !startValid && !!geoStart;
  const endApprox = !endValid && !!geoEnd;
  const bothPoints = startPoint && endPoint;

  useEffect(() => {
    setRoute(null);
    setRouteError(false);
    if (!bothPoints) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${startPoint[1]},${startPoint[0]};${endPoint[1]},${endPoint[0]}?overview=full&geometries=geojson`;
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (coords) setRoute(coords.map(([lon, lat]) => [lat, lon]));
        else setRouteError(true);
      })
      .catch(() => !cancelled && setRouteError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, startPoint?.[0], startPoint?.[1], endPoint?.[0], endPoint?.[1]]);

  if (!trip) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-graphite-600 bg-graphite-800 text-sm text-mist-500">
        Sélectionnez un trajet pour afficher le tracé
      </div>
    );
  }

  const anyGeoLoading = geoStartLoading || geoEndLoading;

  if (!startPoint && !endPoint) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-graphite-600 bg-graphite-800 text-sm text-mist-500">
        {anyGeoLoading ? "Localisation de l'adresse…" : "Coordonnées indisponibles pour ce trajet"}
      </div>
    );
  }

  const linePoints = bothPoints ? route || [startPoint, endPoint] : null;
  const fitPoints = bothPoints ? [startPoint, endPoint] : startPoint ? [startPoint] : [endPoint];

  const footerParts = [];
  if (anyGeoLoading) footerParts.push("Localisation de l'adresse en cours…");
  if (bothPoints) {
    if (route) footerParts.push("Itinéraire routier estimé (OSRM)");
    else if (routeError) footerParts.push("Itinéraire indisponible — ligne directe affichée");
    else if (!anyGeoLoading) footerParts.push("Calcul de l'itinéraire…");
  } else if (startPoint && !geoEndLoading) {
    footerParts.push("Coordonnées d'arrivée indisponibles — seul le point de départ est affiché.");
  } else if (endPoint && !geoStartLoading) {
    footerParts.push("Coordonnées de départ indisponibles — seul le point d'arrivée est affiché.");
  }
  if (startApprox || endApprox) {
    footerParts.push("Position approximative basée sur l'adresse (Nominatim/OSM)");
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-md border border-graphite-600">
      <div className="relative flex-1">
        <MapContainer
          center={startPoint || endPoint}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {linePoints && (
            <Polyline
              positions={linePoints}
              pathOptions={{
                color: "#5B8CFF",
                weight: 3,
                opacity: 0.85,
                dashArray: route ? undefined : "6 6",
              }}
            />
          )}
          {startPoint && (
            <Marker position={startPoint} icon={startApprox ? startIconApprox : startIcon}>
              <Popup>
                Départ{startApprox ? " (position approximative)" : ""} — {trip.start_street}{" "}
                {trip.start_city}
              </Popup>
            </Marker>
          )}
          {endPoint && (
            <Marker position={endPoint} icon={endApprox ? endIconApprox : endIcon}>
              <Popup>
                Arrivée{endApprox ? " (position approximative)" : ""} — {trip.end_street}{" "}
                {trip.end_city}
              </Popup>
            </Marker>
          )}
          <FitBounds points={fitPoints} />
          <CtrlScrollZoom />
        </MapContainer>
      </div>
      <div className="border-t border-graphite-600 bg-graphite-800 px-3 py-1.5 text-xs text-mist-500">
        {footerParts.join(" · ") || "\u00A0"}
      </div>
    </div>
  );
}
