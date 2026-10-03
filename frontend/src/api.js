const BASE_URL = import.meta.env.VITE_API_URL || "/api";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Erreur ${res.status}`);
  }
  return res.json();
}

export async function startImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/import`, {
    method: "POST",
    body: formData,
  });
  return handle(res);
}

export async function getImportStatus(jobId) {
  const res = await fetch(`${BASE_URL}/import/${jobId}`);
  return handle(res);
}

export async function getVehicles() {
  const res = await fetch(`${BASE_URL}/vehicles`);
  return handle(res);
}

export async function getTrips(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, v);
  });
  const res = await fetch(`${BASE_URL}/trips?${query.toString()}`);
  return handle(res);
}

export async function getStats(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, v);
  });
  const res = await fetch(`${BASE_URL}/stats?${query.toString()}`);
  return handle(res);
}

export async function getRecurringRoutes(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, v);
  });
  const res = await fetch(`${BASE_URL}/stats/recurring?${query.toString()}`);
  return handle(res);
}

export async function getRecords(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, v);
  });
  const res = await fetch(`${BASE_URL}/stats/records?${query.toString()}`);
  return handle(res);
}

export async function getHeatmap(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, v);
  });
  const res = await fetch(`${BASE_URL}/stats/heatmap?${query.toString()}`);
  return handle(res);
}

export async function geocodeAddress({ street, city, postal_code, country }) {
  const query = new URLSearchParams();
  if (street) query.set("street", street);
  if (city) query.set("city", city);
  if (postal_code) query.set("postal_code", postal_code);
  if (country) query.set("country", country);
  const res = await fetch(`${BASE_URL}/geocode?${query.toString()}`);
  return handle(res);
}

export async function deleteAllTrips() {
  const res = await fetch(`${BASE_URL}/trips`, { method: "DELETE" });
  return handle(res);
}
