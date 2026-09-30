import { database, databaseConfigured } from "./firebase-config.js";
import { get, onValue, push, ref, set, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const DEMO_KEY = "smart-college-bus-demo-v1";

function readDemoStore() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDemoStore(store) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("demo-data-updated"));
}

export function getDemoCollection(collection) {
  const values = readDemoStore()[collection] || {};
  return Object.entries(values).map(([id, value]) => ({ id, ...value }));
}

export function getDemoBus() {
  return readDemoStore().bus || null;
}

export async function listRecords(collection) {
  if (!databaseConfigured || !database) return getDemoCollection(collection);
  const snapshot = await get(ref(database, collection));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value }));
}

export function watchRecords(collection, onRecords, onError = () => {}) {
  if (!databaseConfigured || !database) {
    const refresh = () => onRecords(getDemoCollection(collection));
    refresh();
    window.addEventListener("demo-data-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("demo-data-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }
  return onValue(ref(database, collection), (snapshot) => {
    const value = snapshot.val() || {};
    onRecords(Object.entries(value).map(([id, record]) => ({ id, ...record })));
  }, onError);
}

export async function saveRecord(collection, value, id = null) {
  if (!databaseConfigured || !database) {
    const store = readDemoStore();
    store[collection] ||= {};
    const recordId = id || `demo-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
    store[collection][recordId] = { ...value, demo: true };
    writeDemoStore(store);
    return recordId;
  }
  const target = id ? ref(database, `${collection}/${id}`) : push(ref(database, collection));
  await set(target, value);
  return target.key;
}

export async function updateRecord(path, value) {
  if (!databaseConfigured || !database) {
    const store = readDemoStore();
    const [collection, id] = path.split("/");
    if (collection === "buses") store.bus = { ...(store.bus || {}), [id]: value };
    else store[collection] = { ...(store[collection] || {}), [id]: value };
    writeDemoStore(store);
    return;
  }
  await update(ref(database, path), value);
}

export async function getBus(busId = "bus-01") {
  if (!databaseConfigured || !database) return getDemoBus()?.[busId] || null;
  const snapshot = await get(ref(database, `buses/${busId}`));
  return snapshot.exists() ? snapshot.val() : null;
}

export function watchBus(busId, onBus, onError = () => {}) {
  if (!databaseConfigured || !database) {
    const refresh = () => onBus(getDemoBus()?.[busId] || null);
    refresh();
    window.addEventListener("demo-data-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("demo-data-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }
  return onValue(ref(database, `buses/${busId}`), (snapshot) => onBus(snapshot.val()), onError);
}

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(timestamp) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

export function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

export async function simulateScan() {
  const students = await listRecords("students");
  const student = students[0] || { id: "demo-student", name: "Anand Kumar", rollNo: "DEMO001", department: "Computer Science", year: "3", busNo: "BUS-01", rfidUid: "A1B2C3D4" };
  if (databaseConfigured && !students.length) throw new Error("Add a student with an RFID UID before simulating a scan.");
  if (!databaseConfigured && !students.length) await saveRecord("students", student, student.id);
  const today = todayKey();
  const existing = await listRecords("attendance");
  if (existing.some((record) => record.studentId === student.id && record.date === today)) {
    return { duplicate: true, student };
  }
  const now = Date.now();
  await saveRecord("attendance", {
    studentId: student.id,
    name: student.name,
    rollNo: student.rollNo,
    rfidUid: student.rfidUid,
    busNo: student.busNo || "BUS-01",
    date: today,
    time: formatTime(now),
    timestamp: now,
    status: "PRESENT",
    demo: true
  });
  return { duplicate: false, student };
}

export async function simulateLocation() {
  const bus = {
    busNo: "BUS-01",
    driver: "Demo Driver",
    status: "ONLINE",
    latitude: 10.9601,
    longitude: 78.0766,
    speed: 24,
    lastUpdated: Date.now(),
    demo: true
  };
  await updateRecord("buses/bus-01", bus);
  return bus;
}