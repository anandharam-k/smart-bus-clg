import { formatDate, formatTime, watchBus } from "./core.js";

const emptyState = document.querySelector("[data-map-empty]");
const gpsSource = document.querySelector("[data-gps-source]");
let map = null;
let marker = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function renderBus(bus) {
  if (!bus || !Number.isFinite(Number(bus.latitude)) || !Number.isFinite(Number(bus.longitude))) {
    emptyState.hidden = false;
    gpsSource.textContent = "Waiting for GPS data…";
    gpsSource.classList.remove("has-data");
    document.querySelector("[data-track-status]").textContent = bus?.status || "WAITING";
    document.querySelector("[data-track-status]").className = "pill pill-muted";
    return;
  }
  const position = [Number(bus.latitude), Number(bus.longitude)];
  emptyState.hidden = true;
  document.querySelector("[data-track-busno]").textContent = bus.busNo || "BUS-01";
  document.querySelector("[data-track-driver]").textContent = bus.driver || "Driver not set";
  document.querySelector("[data-track-status]").textContent = bus.status || "ONLINE";
  document.querySelector("[data-track-status]").className = `pill ${String(bus.status).toUpperCase() === "ONLINE" ? "" : "pill-muted"}`;
  document.querySelector("[data-latitude]").textContent = position[0].toFixed(6);
  document.querySelector("[data-longitude]").textContent = position[1].toFixed(6);
  document.querySelector("[data-speed]").textContent = bus.speed == null ? "—" : `${Number(bus.speed).toFixed(1)} km/h`;
  document.querySelector("[data-track-updated]").textContent = bus.lastUpdated ? `${formatTime(bus.lastUpdated)} · ${formatDate(bus.lastUpdated)}` : "—";
  gpsSource.textContent = bus.demo ? "DEMO DATA · Simulated coordinates" : "Live data · Last position received from Firebase";
  gpsSource.classList.add("has-data");

  if (!window.L) {
    emptyState.hidden = false;
    emptyState.querySelector("b").textContent = "Map library unavailable";
    emptyState.querySelector("span:last-child").textContent = "The location coordinates are available, but Leaflet could not load.";
    return;
  }
  if (!map) {
    map = window.L.map("map", { zoomControl: true }).setView(position, 15);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
    marker = window.L.marker(position).addTo(map);
  } else {
    map.setView(position, Math.max(map.getZoom(), 14));
    marker.setLatLng(position);
  }
  marker.bindPopup(`<b>${escapeHTML(bus.busNo || "BUS-01")}</b>${bus.demo ? " · DEMO DATA" : ""}`);
  window.setTimeout(() => map.invalidateSize(), 0);
}

watchBus("bus-01", renderBus, (error) => {
  emptyState.hidden = false;
  emptyState.querySelector("b").textContent = "GPS connection error";
  emptyState.querySelector("span:last-child").textContent = error.message || "Unable to read bus location from Firebase.";
  gpsSource.textContent = "Firebase connection error";
});