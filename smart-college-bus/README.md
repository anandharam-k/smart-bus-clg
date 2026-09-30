# Smart College Bus Student Tracking System

A college IoT prototype that pairs RFID-based student boarding records with GPS bus positions and a responsive Firebase-backed web dashboard. Hardware activity is real only after the ESP32 is configured and connected. The browser demo controls create explicitly labeled simulated records; they never claim to be hardware data.

## Features

- Admin sign-in with Firebase Authentication.
- Student directory with RFID UID duplicate checks and searchable records.
- Attendance records from Firebase, with date and bus filters.
- Bus location view using Leaflet and OpenStreetMap. The map waits for valid coordinates rather than showing a fabricated live position.
- Attendance summary, print layout, and CSV export.
- Explicit demo controls for a simulated RFID scan and bus location. Without Firebase configuration, demo records stay in this browser's local storage.
- ESP32 firmware for RC522 RFID, NEO-6M GPS, Wi-Fi, Realtime Database, buzzer, and LED.

## Project structure

```text
smart-college-bus/
├── index.html
├── login.html
├── dashboard.html
├── students.html
├── attendance.html
├── tracking.html
├── reports.html
├── css/style.css
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── core.js
│   ├── shell.js
│   ├── dashboard.js
│   ├── students.js
│   ├── attendance.js
│   ├── tracking.js
│   └── reports.js
└── hardware/esp32_bus_tracker.ino
```

## Hardware

- ESP32 development board
- MFRC522 RC522 reader and RFID cards/tags
- NEO-6M GPS module
- Active buzzer, LED, and suitable current-limiting resistor
- Breadboard, jumper wires, and USB power

### Wiring

| Module | Pin | ESP32 |
| --- | --- | --- |
| RC522 | SDA / SS | GPIO 5 |
| RC522 | SCK | GPIO 18 |
| RC522 | MOSI | GPIO 23 |
| RC522 | MISO | GPIO 19 |
| RC522 | RST | GPIO 22 |
| RC522 | 3.3V | 3V3 |
| RC522 | GND | GND |
| NEO-6M | TX | GPIO 16 (ESP32 RX2) |
| NEO-6M | RX | GPIO 17 (ESP32 TX2) |
| NEO-6M | VCC | Module-rated supply; check its board specification |
| NEO-6M | GND | GND |
| Buzzer | Positive | GPIO 25 |
| Buzzer | Negative | GND |
| LED | Anode through resistor | GPIO 26 |
| LED | Cathode | GND |

The RC522 uses **3.3V power and 3.3V logic only**. Do not connect its signal pins to 5V. Share ground between modules and the ESP32. Verify the NEO-6M breakout's supply requirements before wiring; its UART logic should be compatible with ESP32 3.3V inputs.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. Enable **Authentication → Email/Password**. The supplied web app settings are entered in `js/firebase-config.js`; administrators can create an account from the **Create an account** option on `login.html`, or pre-create accounts in the Firebase console.
3. Create a **Realtime Database** in a region suitable for your project.
4. The Firebase Web app configuration is in `js/firebase-config.js`. Analytics initializes only when the browser reports support. Add the Realtime Database URL from the Firebase console to its `databaseURL` field; until then Authentication can initialize, but database pages use browser-local DEMO DATA. These are client configuration values, not service-account credentials. Never place a service-account JSON or admin private key in this project.
5. For a prototype, require an authenticated user for database access. A starting Realtime Database rules example is:

   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null",
       "students": {
         ".indexOn": ["rfidUid"]
       },
       "attendance": {
         ".indexOn": ["studentId"]
       }
     }
   }
   ```

  These broad authenticated-user rules are for a classroom prototype only. Every self-registered account can enter the admin workspace in this prototype. Before using real student data, disable open registration or replace it with an invitation flow, and implement trusted role-based, path-specific authorization, input validation, transport/device identity, and monitoring. Do not use public read/write rules.
6. Sign in to the dashboard or create an account from `login.html`. When `firebase-config.js` still has its `YOUR_...` values, the site shows a not-configured message and account creation is unavailable; cloud-backed features remain unavailable.

### Database shape

Firebase Realtime Database stores records by generated IDs. The firmware looks up a student by `rfidUid`, then adds one attendance record per student per local calendar day. It writes the most recent vehicle coordinates to `buses/bus-01`.

```text
students/{studentId}: { name, rollNo, department, year, busNo, rfidUid }
attendance/{attendanceId}: { studentId, name, rollNo, rfidUid, busNo, date, time, timestamp, status, source }
buses/bus-01: { busNo, driver, status, latitude, longitude, speed, lastUpdated, source }
users/{userId}: { name, email, role }  # optional profile data; Authentication owns credentials
```

The ESP32 uses `orderBy("rfidUid")` and `orderBy("studentId")`. Keep matching `.indexOn` entries in the deployed rules. UID values are normalized to uppercase hexadecimal without separators in both the web app and firmware.

## Run the website

1. Open the `smart-college-bus` folder in VS Code.
2. Install/enable the **Live Server** extension if it is not already available.
3. Right-click `index.html` and choose **Open with Live Server**. ES modules and Firebase require an HTTP origin; opening the HTML directly as a `file://` URL is not supported.
4. Use **View system** to open the dashboard. With no Firebase config, local demo data is labeled and saved to this browser only. Sign-in and sign-up require Firebase configuration.
5. Use **Simulate RFID scan** to create a demo student (if needed) and attendance record, then visit Attendance or Reports. Use **Simulate bus location** to populate the demo map with sample coordinates.

The map tiles, Firebase SDK, and Google Fonts require an internet connection. If the map library or tiles are unavailable, location values remain visible where possible and the map displays a clear status.

## Arduino IDE and ESP32

1. Install Arduino IDE and add Espressif's ESP32 board package using the Board Manager instructions for your Arduino IDE version.
2. Install these libraries through Library Manager:
   - MFRC522 by GithubCommunity
   - TinyGPSPlus by Mikal Hart
   - Firebase ESP Client by Mobizt
3. Select the correct ESP32 board and serial port.
4. Create `hardware/secrets.h` locally (do not commit real passwords) with your Wi-Fi and Firebase Authentication details:

   ```cpp
   #define WIFI_SSID "your-wifi-name"
   #define WIFI_PASSWORD "your-wifi-password"
   #define FIREBASE_API_KEY "your-web-api-key"
   #define FIREBASE_DATABASE_URL "https://your-project-default-rtdb.firebaseio.com"
   #define FIREBASE_USER_EMAIL "device-account@example.edu"
   #define FIREBASE_USER_PASSWORD "your-device-account-password"
   ```

   Use a dedicated Firebase account for the device in a prototype, not a staff member's personal account. The firmware credential is extractable from a physical device; a deployed system should use a trusted backend or short-lived scoped credentials instead.
5. Configure the Firebase database URL and Authentication account to match the web project. Deploy authenticated-only rules and the indexes described above.
6. Connect the hardware using the table above, compile, and upload `hardware/esp32_bus_tracker.ino`.
7. Open Serial Monitor at **115200 baud**. The GPS may need a clear view of the sky and a few minutes to obtain its first fix.

The sketch uses the India Standard Time zone (`IST-5:30`) for its date/time fields. Change `configTzTime` in the sketch for a different deployment region.

## How the prototype works

1. A card UID is read from RC522 and normalized to uppercase hexadecimal.
2. The ESP32 queries `/students` for that UID. Unknown cards produce a warning beep and are not uploaded.
3. A known student is checked against that day's attendance records. Repeat taps are ignored; successful first scans create a `PRESENT` record and give a short buzzer beep and LED flash.
4. TinyGPS++ parses NEO-6M serial data. When a valid updated position is available, the ESP32 updates `buses/bus-01`; the dashboard tracks that node.
5. Firebase Realtime Database listeners update the web views as records change.

This prototype performs a daily duplicate check. Realtime Database rules do not make that multi-client check transactional; if multiple buses can scan the same student simultaneously, move attendance creation and deduplication to a trusted backend transaction/function.

## Testing and demo checklist

- With Firebase unconfigured, confirm the dashboard shows the configuration notice and tracking says **Waiting for GPS data…**.
- Simulate a scan; confirm a DEMO DATA student and attendance row appear on the dashboard, Students, Attendance, and Reports pages.
- Simulate the scan again on the same day; confirm the duplicate message and no extra record.
- Simulate a bus position; confirm only the explicitly simulated coordinates appear and the map marker is labeled DEMO DATA.
- Search students, filter attendance by date/bus, export CSV, and use Print report.
- Configure Firebase, add an Auth account and a student with an uppercase RFID UID, then verify login, browser realtime updates, and an actual ESP32 scan.
- Test unknown RFID, Wi-Fi loss, Firebase permission errors, and GPS with no fix before presenting the hardware.

## Troubleshooting

- **Firebase not configured:** Replace the `YOUR_...` values in `js/firebase-config.js`; reload the site.
- **Login rejected:** Enable Email/Password in Firebase Authentication, create the account in the console, and verify the configured web app project.
- **Permission denied:** Check Realtime Database rules, that Authentication is active on the ESP32 and browser, and that the expected indexes are deployed.
- **No student found:** Register the exact card UID. The web app and sketch compare uppercase hexadecimal without spaces or separators.
- **Duplicate attendance:** The prototype marks one record per student per calendar day; verify the configured device time zone and the existing record's `date`.
- **GPS waiting:** Check crossed UART wiring (module TX to ESP32 RX2), baud rate (9600), power, common ground, antenna placement, and satellite visibility.
- **RC522 not detected:** Confirm 3.3V power/logic, SPI pins, shared ground, and the selected ESP32 board.
- **No map tiles:** Check network access to OpenStreetMap and unpkg; coordinate data itself comes from Realtime Database.

## Future enhancements

- Server-side role permissions, audit logs, and transactional duplicate prevention.
- Multiple bus/route management and driver profiles.
- Arrival estimates, geofences, and notifications for guardians.
- Offline ESP32 queueing with retry and device provisioning.
- Automated firmware tests and monitoring for GPS/Wi-Fi health.