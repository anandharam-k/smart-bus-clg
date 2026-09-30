import { listRecords, saveRecord, watchRecords } from "./core.js";

const formPanel = document.querySelector("[data-student-form-panel]");
const form = document.querySelector("#student-form");
const message = document.querySelector("#student-message");
const rows = document.querySelector("[data-student-rows]");
const search = document.querySelector("[data-student-search]");
let students = [];

document.querySelector("[data-open-student-form]")?.addEventListener("click", () => { formPanel.hidden = false; form.elements.name.focus(); });
document.querySelectorAll("[data-close-student-form]").forEach((button) => button.addEventListener("click", () => { formPanel.hidden = true; message.textContent = ""; }));
search?.addEventListener("input", renderStudents);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function renderStudents() {
  const query = search.value.trim().toLowerCase();
  const visible = students.filter((student) => [student.name, student.rollNo, student.department, student.busNo, student.rfidUid].some((value) => String(value || "").toLowerCase().includes(query)));
  document.querySelector("[data-student-count]").textContent = String(students.length);
  rows.innerHTML = visible.length ? visible.map((student) => `<tr><td>${escapeHTML(student.name)}${student.demo ? '<span class="demo-tag">DEMO</span>' : ""}</td><td>${escapeHTML(student.rollNo)}</td><td>${escapeHTML(student.department)}</td><td>${escapeHTML(student.year)}</td><td>${escapeHTML(student.busNo)}</td><td><code class="uid-code">${escapeHTML(student.rfidUid)}</code></td><td><span class="pill">ACTIVE</span></td></tr>`).join("") : `<tr><td colspan="7" class="empty-state">${students.length ? "No students match your search." : "No student records yet. Add a student to get started."}</td></tr>`;
}

watchRecords("students", (records) => { students = records; renderStudents(); }, (error) => {
  rows.innerHTML = `<tr><td colspan="7" class="empty-state">Could not load students: ${escapeHTML(error.message)}</td></tr>`;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  data.rfidUid = data.rfidUid.trim().replace(/\s+/g, "").toUpperCase();
  data.rollNo = data.rollNo.trim().toUpperCase();
  data.busNo = data.busNo.trim().toUpperCase();
  if (students.some((student) => student.rfidUid?.toUpperCase() === data.rfidUid)) {
    message.textContent = "This RFID UID is already registered to another student.";
    form.elements.rfidUid.focus();
    return;
  }
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    await saveRecord("students", data);
    form.reset();
    formPanel.hidden = true;
  } catch (error) {
    message.textContent = `Could not save student: ${error.message || "Check Firebase connection and database rules."}`;
  } finally {
    submit.disabled = false;
  }
});