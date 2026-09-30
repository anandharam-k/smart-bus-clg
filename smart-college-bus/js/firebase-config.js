import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// Firebase web app settings. Never add a service-account key here.
const firebaseConfig = {
  apiKey: "AIzaSyA9NAHlN9UW-OGKNzMQHfAMFokfu4IU2fo",
  authDomain: "smart-bus-system-82e1c.firebaseapp.com",
  databaseURL: "YOUR_REALTIME_DATABASE_URL",
  projectId: "smart-bus-system-82e1c",
  storageBucket: "smart-bus-system-82e1c.firebasestorage.app",
  messagingSenderId: "169526443798",
  appId: "1:169526443798:web:0908894ac6abbafa695a37",
  measurementId: "G-9GFRW93YJQ"
};

const configured = [firebaseConfig.apiKey, firebaseConfig.authDomain, firebaseConfig.projectId, firebaseConfig.appId]
  .every((value) => value && !value.startsWith("YOUR_"));
const databaseConfigured = configured && firebaseConfig.databaseURL && !firebaseConfig.databaseURL.startsWith("YOUR_");
let app = null;
let auth = null;
let database = null;
let analytics = null;
let configurationError = null;

if (configured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    if (databaseConfigured) database = getDatabase(app);
    isSupported().then((supported) => {
      if (supported) analytics = getAnalytics(app);
    }).catch(() => {});
  } catch (error) {
    configurationError = error;
  }
}

export { analytics, auth, configured, configurationError, database, databaseConfigured };