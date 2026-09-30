import { formatDate, todayKey, watchRecords } from "./core.js";

const reportBody = document.querySelector("[data-report-rows]");
const periodSelect = document.querySelector("[data-report-period]");
let attendance = [];
let students = [];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function selectedAttendance() {
  const days = periodSelect.value === "all" ? null : Number(periodSelect.value);
  const earliest = days ? new Date(Date.now() - days * 86400000) : null;
  return attendance.filter((record) => !earliest || !record.timestamp || Number(record.timestamp) >= earliest.getTime());
}

function render() {
  const selected = selectedAttendance();
  const today = selected.filter((record) => record.date === todayKey());
  const weekStart = Date.now() - 7 * 86400000;
  const week = attendance.filter((record) => !record.timestamp || Number(record.timestamp) >= weekStart);
  document.querySelector("[data-report-daily]").textContent = String(today.length);
  document.querySelector("[data-report-weekly]").textContent = String(week.length);
  const busCounts = new Map();
  selected.forEach((record) => busCounts.set(record.busNo || "Unknown", (busCounts.get(record.busNo || "Unknown") || 0) + 1));
  const leader = [...busCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  document.querySelector("[data-report-bus]").textContent = leader ? `${leader[0]} · ${leader[1]}` : "—";
  const grouped = new Map();
  selected.forEach((record) => {
    const key = `${record.date || "Unknown"}|${record.busNo || "Unknown"}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  reportBody.innerHTML = sortedGroups.length ? sortedGroups.map(([key, count]) => {
    const [date, bus] = key.split("|");
    const share = students.length ? Math.min(100, Math.round((count / students.length) * 100)) : null;
    return `<tr><td>${escapeHTML(date === "Unknown" ? date : formatDate(new Date(`${date}T12:00:00`).getTime()))}</td><td>${escapeHTML(bus)}</td><td>${count}</td><td>${share == null ? "—" : `${share}%`}</td></tr>`;
  }).join("") : '<tr><td colspan="4" class="empty-state">No records available for this period.</td></tr>';
}

periodSelect.addEventListener("change", render);
watchRecords("attendance", (records) => { attendance = records; render(); }, (error) => { reportBody.innerHTML = `<tr><td colspan="4" class="empty-state">Could not load reports: ${escapeHTML(error.message)}</td></tr>`; });
watchRecords("students", (records) => { students = records; render(); });

document.querySelector("[data-print-report]").addEventListener("click", () => window.print());
document.querySelector("[data-export-csv]").addEventListener("click", () => {
  const records = selectedAttendance().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  if (!records.length) {
    reportBody.setAttribute("aria-live", "polite");
    reportBody.innerHTML = '<tr><td colspan="4" class="empty-state">No records to export for this period.</td></tr>';
    return;
  }
  const columns = ["name", "rollNo", "rfidUid", "busNo", "date", "time", "timestamp", "status", "demo"];
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...records.map((record) => columns.map((column) => csvCell(record[column])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bus-attendance-${todayKey()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
});