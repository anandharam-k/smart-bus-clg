import { formatDate, formatTime, todayKey, watchRecords } from "./core.js";

const body = document.querySelector("[data-attendance-rows]");
const dateFilter = document.querySelector("[data-attendance-date]");
const busFilter = document.querySelector("[data-attendance-bus]");
let attendance = [];
let buses = new Set();
dateFilter.value = todayKey();

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function render() {
  const date = dateFilter.value;
  const busNo = busFilter.value;
  const filtered = attendance.filter((record) => (!date || record.date === date) && (!busNo || record.busNo === busNo)).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  body.innerHTML = filtered.length ? filtered.map((record) => `<tr><td>${escapeHTML(record.name || "Unknown student")}${record.demo ? '<span class="demo-tag">DEMO</span>' : ""}</td><td>${escapeHTML(record.rollNo || "—")}</td><td><code class="uid-code">${escapeHTML(record.rfidUid || "—")}</code></td><td>${escapeHTML(record.busNo || "—")}</td><td>${escapeHTML(record.date ? formatDate(new Date(`${record.date}T12:00:00`).getTime()) : "—")}</td><td>${escapeHTML(record.time || formatTime(record.timestamp))}</td><td><span class="pill">${escapeHTML(record.status || "PRESENT")}</span></td></tr>`).join("") : '<tr><td colspan="7" class="empty-state">No attendance records match these filters.</td></tr>';
  document.querySelector("[data-attendance-total]").textContent = `${filtered.length} record${filtered.length === 1 ? "" : "s"}${date ? ` for ${date}` : ""}${busNo ? ` · ${busNo}` : ""}`;
}

dateFilter.addEventListener("change", render);
busFilter.addEventListener("change", render);
watchRecords("attendance", (records) => {
  attendance = records;
  const nextBuses = new Set(records.map((record) => record.busNo).filter(Boolean));
  if ([...nextBuses].join("|") !== [...buses].join("|")) {
    const selected = busFilter.value;
    buses = nextBuses;
    busFilter.innerHTML = '<option value="">All buses</option>' + [...buses].sort().map((bus) => `<option value="${escapeHTML(bus)}">${escapeHTML(bus)}</option>`).join("");
    busFilter.value = selected;
  }
  render();
}, (error) => { body.innerHTML = `<tr><td colspan="7" class="empty-state">Could not load attendance: ${escapeHTML(error.message)}</td></tr>`; });