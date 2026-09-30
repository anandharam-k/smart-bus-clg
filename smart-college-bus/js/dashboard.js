import { databaseConfigured } from "./firebase-config.js";
import { formatDate, formatTime, todayKey, watchBus, watchRecords } from "./core.js";

const stats = Object.fromEntries([...document.querySelectorAll("[data-stat]")].map((element) => [element.dataset.stat, element]));
const presentCaption = document.querySelector("[data-attendance-rate]");
const recentBody = document.querySelector("[data-recent-attendance]");
let students = [];
let attendance = [];

function renderStats() {
  const todaysAttendance = attendance.filter((record) => record.date === todayKey());
  const presentIds = new Set(todaysAttendance.map((record) => record.studentId));
  const present = presentIds.size;
  const absent = Math.max(students.length - present, 0);
  stats.students.textContent = String(students.length);
  stats.present.textContent = String(present);
  stats.absent.textContent = String(absent);
  if (presentCaption) presentCaption.textContent = students.length ? `${Math.round((present / students.length) * 100)}% attendance recorded` : "No students registered";
  const latest = [...attendance].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5);
  recentBody.innerHTML = latest.length ? latest.map((record) => `<tr><td>${escapeHTML(record.name || "Unknown student")}${record.demo ? '<span class="demo-tag">DEMO</span>' : ""}</td><td>${escapeHTML(record.busNo || "—")}</td><td>${escapeHTML(record.time || formatTime(record.timestamp))}</td><td><span class="pill">${escapeHTML(record.status || "PRESENT")}</span></td></tr>`).join("") : '<tr><td colspan="4" class="empty-state">No scans recorded today.</td></tr>';
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

watchRecords("students", (records) => { students = records; renderStats(); }, showDataError);
watchRecords("attendance", (records) => { attendance = records; renderStats(); }, showDataError);
watchBus("bus-01", (bus) => {
  const active = bus?.status?.toUpperCase() === "ONLINE";
  stats.buses.textContent = active ? "1" : "0";
  document.querySelector("[data-bus-status]").textContent = active ? (bus.demo ? "DEMO DATA · Online" : "Bus online") : "No active bus reports";
  document.querySelector("[data-bus-driver]").textContent = bus?.driver || "Driver not set";
  document.querySelector("[data-bus-pill]").textContent = active ? "ONLINE" : "WAITING";
  document.querySelector("[data-bus-pill]").className = `pill ${active ? "" : "pill-muted"}`;
  document.querySelector("[data-bus-coordinates]").textContent = bus?.latitude != null && bus?.longitude != null ? `${Number(bus.latitude).toFixed(4)}, ${Number(bus.longitude).toFixed(4)}${bus.demo ? " · DEMO" : ""}` : "Waiting for GPS data…";
  document.querySelector("[data-bus-updated]").textContent = bus?.lastUpdated ? `${formatTime(bus.lastUpdated)} · ${formatDate(bus.lastUpdated)}` : "—";
}, showDataError);

function showDataError(error) {
  const target = document.querySelector("[data-config-notice]");
  if (target) {
    target.hidden = false;
    target.textContent = `Firebase connection error: ${error.message || "Could not load data."}`;
  }
}

if (!databaseConfigured) document.querySelector("[data-current-date]")?.setAttribute("title", "Explicitly simulated entries are stored as DEMO DATA in this browser.");