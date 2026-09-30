import { auth, configured } from "./firebase-config.js";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const form = document.querySelector("#login-form");
const message = document.querySelector("#login-message");
const confirmField = document.querySelector("[data-confirm-field]");
const confirmPassword = form.elements.confirmPassword;
const submitButton = form.querySelector("button[type='submit']");
const toggleButton = document.querySelector("[data-auth-toggle]");
let isSignUp = false;

if (auth) onAuthStateChanged(auth, (user) => { if (user) window.location.replace("dashboard.html"); });

toggleButton?.addEventListener("click", () => {
  isSignUp = !isSignUp;
  confirmField.hidden = !isSignUp;
  confirmPassword.required = isSignUp;
  document.querySelector("#password").autocomplete = isSignUp ? "new-password" : "current-password";
  document.querySelector("#login-title").textContent = isSignUp ? "Create account." : "Welcome back.";
  document.querySelector("[data-auth-intro]").textContent = isSignUp ? "Create an account to access campus transit." : "Sign in to manage campus transit.";
  document.querySelector("[data-auth-switch-text]").textContent = isSignUp ? "Already have an account?" : "New to the system?";
  toggleButton.textContent = isSignUp ? "Sign in" : "Create an account";
  document.querySelector("[data-signup-note]").hidden = !isSignUp;
  submitButton.innerHTML = isSignUp ? 'Create account <span aria-hidden="true">→</span>' : 'Sign in <span aria-hidden="true">→</span>';
  message.textContent = "";
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    message.textContent = "Enter a valid email address.";
    form.elements.email.focus();
    return;
  }
  if (!password) {
    message.textContent = "Enter your password.";
    form.elements.password.focus();
    return;
  }
  if (isSignUp && password.length < 6) {
    message.textContent = "Use at least 6 characters for your password.";
    form.elements.password.focus();
    return;
  }
  if (isSignUp && password !== confirmPassword.value) {
    message.textContent = "The passwords do not match.";
    confirmPassword.focus();
    return;
  }
  if (!configured || !auth) {
    message.textContent = "Firebase is not configured. Add your Firebase web app settings before continuing.";
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = isSignUp ? "Creating account…" : "Signing in…";
  try {
    if (isSignUp) await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (error) {
    const messages = {
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/network-request-failed": "Network error. Check your connection and try again.",
      "auth/email-already-in-use": "An account already exists for this email. Sign in instead.",
      "auth/weak-password": "Use a stronger password with at least 6 characters.",
      "auth/operation-not-allowed": "Email and password accounts are disabled in Firebase Authentication."
    };
    message.textContent = messages[error.code] || `${isSignUp ? "Account creation" : "Sign-in"} failed. Check your details and Firebase Authentication settings.`;
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = isSignUp ? 'Create account <span aria-hidden="true">→</span>' : 'Sign in <span aria-hidden="true">→</span>';
  }
});