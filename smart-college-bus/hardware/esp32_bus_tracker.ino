#include <WiFi.h>
#include <SPI.h>
#include <MFRC522.h>
#include <TinyGPSPlus.h>
#include <Firebase_ESP_Client.h>
#include <time.h>
#include "secrets.h"

#ifndef WIFI_SSID
#error "Create hardware/secrets.h with WIFI_SSID, WIFI_PASSWORD, FIREBASE_API_KEY, FIREBASE_DATABASE_URL, FIREBASE_USER_EMAIL, and FIREBASE_USER_PASSWORD."
#endif

static constexpr uint8_t RFID_SS_PIN = 5;
static constexpr uint8_t RFID_RST_PIN = 22;
static constexpr uint8_t GPS_RX_PIN = 16;
static constexpr uint8_t GPS_TX_PIN = 17;
static constexpr uint8_t BUZZER_PIN = 25;
static constexpr uint8_t STATUS_LED_PIN = 26;
static constexpr uint32_t GPS_UPLOAD_INTERVAL_MS = 5000;
static constexpr uint32_t DUPLICATE_WINDOW_MS = 12000;
static constexpr char BUS_ID[] = "bus-01";
static constexpr char BUS_NUMBER[] = "BUS-01";

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
FirebaseData firebaseData;
FirebaseAuth firebaseAuth;
FirebaseConfig firebaseConfig;

uint32_t lastGpsUpload = 0;
uint32_t lastWifiAttempt = 0;
String lastScannedUid;
uint32_t lastScanMillis = 0;

String normalizeUid(const MFRC522::Uid &cardUid) {
  String result;
  result.reserve(cardUid.size * 2);
  for (byte index = 0; index < cardUid.size; index++) {
    if (cardUid.uidByte[index] < 0x10) result += '0';
    result += String(cardUid.uidByte[index], HEX);
  }
  result.toUpperCase();
  return result;
}

bool waitForClock() {
  struct tm timeInfo;
  for (uint8_t attempt = 0; attempt < 20; attempt++) {
    if (getLocalTime(&timeInfo, 500)) return true;
    delay(100);
  }
  return false;
}

bool findStudent(const String &uid, String &studentId, String &name, String &rollNo, String &busNo) {
  FirebaseJsonQuery query;
  query.orderBy("rfidUid");
  query.equalTo(uid);
  if (!Firebase.RTDB.getJSON(&firebaseData, "/students", &query)) {
    Serial.printf("Student lookup failed: %s\n", firebaseData.errorReason().c_str());
    return false;
  }

  FirebaseJson matches = firebaseData.to<FirebaseJson>();
  const size_t count = matches.iteratorBegin();
  bool found = false;
  for (size_t index = 0; index < count; index++) {
    String type;
    String key;
    String value;
    matches.iteratorGet(index, type, key, value);
    if (type != "object") continue;

    FirebaseJson student;
    student.setJsonData(value);
    FirebaseJsonData field;
    student.get(field, "rfidUid");
    if (!field.success || !field.stringValue.equalsIgnoreCase(uid)) continue;
    studentId = key;
    student.get(field, "name");
    name = field.stringValue;
    student.get(field, "rollNo");
    rollNo = field.stringValue;
    student.get(field, "busNo");
    busNo = field.stringValue;
    found = true;
    break;
  }
  matches.iteratorEnd();
  return found;
}

bool alreadyMarkedToday(const String &studentId, const String &today, bool &lookupSucceeded) {
  FirebaseJsonQuery query;
  query.orderBy("studentId");
  query.equalTo(studentId);
  if (!Firebase.RTDB.getJSON(&firebaseData, "/attendance", &query)) {
    Serial.printf("Duplicate check failed: %s\n", firebaseData.errorReason().c_str());
    lookupSucceeded = false;
    return false;
  }

  lookupSucceeded = true;
  FirebaseJson matches = firebaseData.to<FirebaseJson>();
  const size_t count = matches.iteratorBegin();
  bool duplicate = false;
  for (size_t index = 0; index < count; index++) {
    String type;
    String key;
    String value;
    matches.iteratorGet(index, type, key, value);
    if (type != "object") continue;
    FirebaseJson record;
    record.setJsonData(value);
    FirebaseJsonData field;
    record.get(field, "date");
    if (field.success && field.stringValue == today) {
      duplicate = true;
      break;
    }
  }
  matches.iteratorEnd();
  return duplicate;
}

void signalSuccess() {
  digitalWrite(STATUS_LED_PIN, HIGH);
  tone(BUZZER_PIN, 2100, 110);
  delay(130);
  digitalWrite(STATUS_LED_PIN, LOW);
}

void signalWarning() {
  for (uint8_t pulse = 0; pulse < 2; pulse++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    tone(BUZZER_PIN, 550, 160);
    delay(190);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(90);
  }
}

void handleCard() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  const String uid = normalizeUid(rfid.uid);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  Serial.printf("RFID Detected: %s\n", uid.c_str());

  const uint32_t nowMillis = millis();
  if (!Firebase.ready()) {
    Serial.println("Firebase unavailable; attendance was not uploaded.");
    signalWarning();
    return;
  }

  String studentId;
  String name;
  String rollNo;
  String busNo;
  if (!findStudent(uid, studentId, name, rollNo, busNo)) {
    Serial.println("Unknown RFID Card");
    signalWarning();
    return;
  }
  Serial.printf("Student Found: %s (%s)\n", name.c_str(), rollNo.c_str());

  if (uid == lastScannedUid && nowMillis - lastScanMillis < DUPLICATE_WINDOW_MS) {
    Serial.println("Attendance already marked. Duplicate scan ignored.");
    tone(BUZZER_PIN, 900, 70);
    return;
  }
  lastScannedUid = uid;
  lastScanMillis = nowMillis;

  struct tm timeInfo;
  if (!getLocalTime(&timeInfo)) {
    Serial.println("Clock unavailable; attendance was not uploaded.");
    signalWarning();
    return;
  }
  char dateBuffer[11];
  char timeBuffer[12];
  strftime(dateBuffer, sizeof(dateBuffer), "%Y-%m-%d", &timeInfo);
  strftime(timeBuffer, sizeof(timeBuffer), "%I:%M %p", &timeInfo);

  bool duplicateLookupSucceeded = false;
  const bool duplicate = alreadyMarkedToday(studentId, String(dateBuffer), duplicateLookupSucceeded);
  if (!duplicateLookupSucceeded) {
    Serial.println("Attendance not uploaded because duplicate status could not be verified.");
    signalWarning();
    return;
  }
  if (duplicate) {
    Serial.println("Attendance already marked.");
    tone(BUZZER_PIN, 900, 70);
    return;
  }

  FirebaseJson attendance;
  attendance.set("studentId", studentId);
  attendance.set("name", name);
  attendance.set("rollNo", rollNo);
  attendance.set("rfidUid", uid);
  attendance.set("busNo", busNo.length() ? busNo : BUS_NUMBER);
  attendance.set("date", dateBuffer);
  attendance.set("time", timeBuffer);
  attendance.set("timestamp", static_cast<double>(time(nullptr)) * 1000.0);
  attendance.set("status", "PRESENT");
  attendance.set("source", "esp32");

  if (Firebase.RTDB.pushJSON(&firebaseData, "/attendance", &attendance)) {
    Serial.printf("Attendance Uploaded: %s\n", firebaseData.pushName().c_str());
    signalSuccess();
  } else {
    Serial.printf("Attendance upload failed: %s\n", firebaseData.errorReason().c_str());
    signalWarning();
  }
}

void uploadGpsIfDue() {
  if (millis() - lastGpsUpload < GPS_UPLOAD_INTERVAL_MS) return;
  lastGpsUpload = millis();
  if (!gps.location.isValid() || !gps.location.isUpdated()) return;
  if (!Firebase.ready()) return;

  FirebaseJson bus;
  bus.set("busNo", BUS_NUMBER);
  bus.set("status", "ONLINE");
  bus.set("latitude", gps.location.lat());
  bus.set("longitude", gps.location.lng());
  if (gps.speed.isValid()) bus.set("speed", gps.speed.kmph());
  bus.set("lastUpdated", static_cast<double>(time(nullptr)) * 1000.0);
  bus.set("source", "esp32");

  const String path = String("/buses/") + BUS_ID;
  if (Firebase.RTDB.updateNode(&firebaseData, path.c_str(), &bus)) {
    Serial.printf("GPS Updated: %.6f, %.6f\n", gps.location.lat(), gps.location.lng());
  } else {
    Serial.printf("GPS upload failed: %s\n", firebaseData.errorReason().c_str());
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED || millis() - lastWifiAttempt < 10000) return;
  lastWifiAttempt = millis();
  Serial.println("WiFi Connecting...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  SPI.begin(18, 19, 23, RFID_SS_PIN);
  rfid.PCD_Init();
  Serial.println("RFID Ready");

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("GPS Ready");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttempt = millis();
  Serial.println("WiFi Connecting...");
  configTzTime("IST-5:30", "pool.ntp.org", "time.google.com");

  firebaseConfig.api_key = FIREBASE_API_KEY;
  firebaseConfig.database_url = FIREBASE_DATABASE_URL;
  firebaseAuth.user.email = FIREBASE_USER_EMAIL;
  firebaseAuth.user.password = FIREBASE_USER_PASSWORD;
  Firebase.reconnectWiFi(true);
  Firebase.begin(&firebaseConfig, &firebaseAuth);
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    static bool reportedConnected = false;
    if (!reportedConnected) {
      Serial.println("WiFi Connected");
      reportedConnected = true;
    }
  }
  handleCard();
  uploadGpsIfDue();
  if (gps.charsProcessed() > 100 && !gps.location.isValid()) {
    static uint32_t lastGpsWarning = 0;
    if (millis() - lastGpsWarning > 10000) {
      Serial.println("GPS unavailable; waiting for satellite fix.");
      lastGpsWarning = millis();
    }
  }
}