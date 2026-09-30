import { auth, configured, configurationError, databaseConfigured } from "./firebase-config.js";
import { formatDate, simulateLocation, simulateScan } from "./core.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const page = document.body.dataset.page;
const navItems = [
  ["dashboard", "Overview", "dashboard.html", "▦"],
  ["students", "Students", "students.html", "♙"],
  ["attendance", "Attendance", "attendance.html", "✓"],
  ["tracking", "Bus tracking", "tracking.html", "⌖"],
  ["reports", "Reports", "reports.html", "▤"]
];

const sidebar = document.querySelector("[data-sidebar]");
const nav = document.querySelector("[data-nav]");
if (nav) {
  nav.innerHTML = navItems.map(([id, label, href, icon]) => `<a class="nav-link ${page === id ? "is-active" : ""}" href="${href}" ${page === id ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join("");
}

const connection = document.querySelector("[data-connection]");
if (connection) {
  connection.classList.toggle("is-connected", databaseConfigured && !configurationError);
  connection.innerHTML = databaseConfigured && !configurationError
    ? '<span class="connection-dot"></span><span>Firebase connected</span>'
    : configured && !configurationError
      ? '<span class="connection-dot"></span><span>Auth ready · database pending</span>'
      : '<span class="connection-dot"></span><span>Firebase not configured</span>';
}

const configNotice = document.querySelector("[data-config-notice]");
if (configNotice && !configured) configNotice.hidden = false;
if (configNotice && configured && !databaseConfigured) {
  configNotice.hidden = false;
  configNotice.textContent = "Firebase Authentication is configured. Add your Realtime Database URL in js/firebase-config.js to enable cloud data; database records currently use browser-local DEMO DATA.";
}
if (configNotice && configurationError) {
  configNotice.hidden = false;
  configNotice.textContent = `Firebase initialization failed: ${configurationError.message}`;
}

document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => sidebar?.classList.toggle("is-open"));
document.addEventListener("click", (event) => {
  if (sidebar?.classList.contains("is-open") && !sidebar.contains(event.target) && !event.target.closest("[data-menu-toggle]")) sidebar.classList.remove("is-open");
});
document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  if (auth) await signOut(auth);
  window.location.href = "login.html";
});

const dateElement = document.querySelector("[data-current-date]");
if (dateElement) dateElement.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date());

function showToast(message, isError = false) {
  let toast = document.querySelector(".app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3300);
}

document.querySelectorAll("[data-simulate-scan]").forEach((button) => button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const result = await simulateScan();
    showToast(result.duplicate ? "Attendance already marked for today." : `DEMO DATA: ${result.student.name} attendance recorded.`);
  } catch (error) {
    showToast(error.message || "Could not simulate RFID scan.", true);
  } finally {
    button.disabled = false;
  }
}));

document.querySelectorAll("[data-simulate-location]").forEach((button) => button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const bus = await simulateLocation();
    showToast(`DEMO DATA: BUS-01 location set to ${bus.latitude}, ${bus.longitude}.`);
  } catch (error) {
    showToast(error.message || "Could not simulate bus location.", true);
  } finally {
    button.disabled = false;
  }
}));

if (auth && page !== "login") {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.replace("login.html");
    else document.querySelectorAll("[data-user-email]").forEach((element) => { element.textContent = user.email || "Administrator"; });
  });
}