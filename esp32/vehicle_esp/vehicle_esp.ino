/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   SMART HELMET — ESP32 #2 : VEHICLE UNIT  (Firebase + ESP-NOW) ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Migrated from local WebServer → Firebase Realtime Database      ║
 * ║  All original hardware logic preserved exactly.                  ║
 * ║                                                                  ║
 * ║  Hardware:                                                       ║
 * ║    Key Pin      → GPIO 4   (connect to GND = key in ignition)   ║
 * ║    Motor IN1    → GPIO 26  (forward = engine runs)              ║
 * ║    Motor IN2    → GPIO 27  (reverse / brake)                    ║
 * ║    GPS Module   → UART2   RX=16, TX=17                         ║
 * ║    SIM800L      → UART1   RX=32, TX=33  (SMS alerts)           ║
 * ║                                                                  ║
 * ║  Data Flow:                                                       ║
 * ║    Receives via ESP-NOW  ← Helmet ESP                           ║
 * ║    Writes to Firebase    → status, lat, lng, helmetOn, crash    ║
 * ║    Reads from Firebase   → pendingCommand (lock/unlock from app) ║
 * ║    Sends SMS via SIM800L → on crash (your existing logic kept)  ║
 * ║                                                                  ║
 * ║  Libraries required:                                             ║
 * ║    • Firebase ESP32 Client  by mobizt  (v4.x)                  ║
 * ║    • TinyGPS++              by Mikal Hart                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include <esp_now.h>
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <TinyGPSPlus.h>

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️  CONFIGURE THESE BEFORE FLASHING
// ─────────────────────────────────────────────────────────────────────────────
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

#define FIREBASE_HOST   "smarthelmet-961f1-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH   "YOUR_FIREBASE_DATABASE_SECRET"
// ☝️  Firebase Console → Project Settings → Service Accounts → Database secrets

#define DRIVER_PHONE    "6200071174"   // Digits only — must match driver app

// Emergency SMS number (your original)
String emergencyNumber = "+917992202784";
// ─────────────────────────────────────────────────────────────────────────────

// ── Pin Definitions (your original) ──────────────────────────────────────────
const int keyPin    = 4;
const int motorIn1  = 26;
const int motorIn2  = 27;

#define GPS_RX  16
#define GPS_TX  17
#define SIM_RX  32
#define SIM_TX  33

// ── Data Packet (must match struct in helmet_esp.ino) ────────────────────────
typedef struct struct_message {
  bool helmetOn;
  bool crashDetected;
} struct_message;
struct_message helmetData;

// ── State Flags ───────────────────────────────────────────────────────────────
bool engineLocked    = false;   // Set by Firebase pendingCommand (app remote lock)
bool engineLockedDown = false;  // Set by crash — hard lock until acknowledged

unsigned long lastFirebasePush    = 0;
unsigned long lastCommandPoll     = 0;
unsigned long lastCheck           = 0;

// ── Firebase ──────────────────────────────────────────────────────────────────
FirebaseData   fbData;
FirebaseConfig fbConfig;
FirebaseAuth   fbAuth;
String vehiclePath = String("vehicles/") + DRIVER_PHONE;

// ── GPS + SIM ─────────────────────────────────────────────────────────────────
TinyGPSPlus     gps;
HardwareSerial  gpsSerial(2);
HardwareSerial  simSerial(1);

// ─────────────────────────────────────────────────────────────────────────────
// SMS Emergency — your original function, unchanged
// ─────────────────────────────────────────────────────────────────────────────
void triggerEmergencyProtocol() {
  // Hard-kill engine immediately
  digitalWrite(motorIn1, LOW);
  digitalWrite(motorIn2, LOW);

  String smsText = "URGENT: Crash Detected! Location: ";
  if (gps.location.isValid()) {
    smsText += "https://www.google.com/maps?q=" +
               String(gps.location.lat(), 6) + "," +
               String(gps.location.lng(), 6);
  } else {
    // Fallback coordinates (NIT Jamshedpur — your original)
    smsText += "https://www.google.com/maps?q=22.7766,86.1437";
  }

  Serial.println("[SIM800L] Sending emergency SMS...");
  simSerial.println("AT+CMGF=1");
  delay(500);
  simSerial.print("AT+CMGS=\""); simSerial.print(emergencyNumber); simSerial.println("\"");
  delay(500);
  simSerial.print(smsText);
  delay(500);
  simSerial.write(26);   // Ctrl+Z to send SMS
  Serial.printf("[SIM800L] SMS sent to %s\n", emergencyNumber.c_str());
}

// ─────────────────────────────────────────────────────────────────────────────
// ESP-NOW Receive Callback — your original logic
// ─────────────────────────────────────────────────────────────────────────────
void OnDataRecv(const esp_now_recv_info *info, const uint8_t *incomingData, int len) {
  memcpy(&helmetData, incomingData, sizeof(helmetData));

  if (helmetData.crashDetected && !engineLockedDown) {
    engineLockedDown = true;
    Serial.println("\n!!! WIRELESS CRASH ALERT RECEIVED FROM HELMET !!!");
    triggerEmergencyProtocol();   // SMS + engine kill (your original)
    // Firebase push happens in main loop — will set status=CRASH, crashActive=true
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase: Push all sensor data to cloud
// ─────────────────────────────────────────────────────────────────────────────
void pushToFirebase(bool keyIn) {
  // Determine status (replaces the old WebServer /status handler)
  String status;
  if (engineLockedDown) {
    status = "CRASH";
  } else if (engineLocked) {
    status = "LOCKED";
  } else if (keyIn && helmetData.helmetOn) {
    if (gps.speed.isValid() && gps.speed.kmph() > 3.0) {
      status = "DRIVING";
    } else {
      status = "IDLE";
    }
  } else {
    status = "IDLE";
  }

  FirebaseJson json;
  json.set("status",      status);
  json.set("helmetOn",    helmetData.helmetOn);
  json.set("crashActive", engineLockedDown);
  json.set("keyIn",       keyIn);
  json.set("timestamp",   (int)millis());

  if (gps.location.isValid()) {
    json.set("lat", gps.location.lat());
    json.set("lng", gps.location.lng());
  }

  if (Firebase.updateNode(fbData, vehiclePath, json)) {
    Serial.printf(
      "[Firebase] ✅ status=%-8s helmet=%s crash=%d key=%s gps=%s\n",
      status.c_str(),
      helmetData.helmetOn ? "ON " : "OFF",
      engineLockedDown,
      keyIn ? "IN " : "OUT",
      gps.location.isValid() ? "OK" : "--"
    );
  } else {
    Serial.printf("[Firebase] ❌ %s\n", fbData.errorReason().c_str());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase: Poll pendingCommand (replaces old /unlock and /lock web handlers)
// ─────────────────────────────────────────────────────────────────────────────
void pollFirebaseCommands() {
  // ── Remote Lock/Unlock from Driver App ──
  String cmdPath = vehiclePath + "/pendingCommand";
  if (Firebase.getString(fbData, cmdPath)) {
    String cmd = fbData.stringData();
    cmd.trim();

    if (cmd == "lock" && !engineLocked) {
      engineLocked = true;
      Serial.println("[Command] 🔒 Remote LOCK received from app.");
      Firebase.setString(fbData, cmdPath, "");   // Clear after processing
    } else if (cmd == "unlock" && engineLocked) {
      engineLocked = false;
      Serial.println("[Command] 🔓 Remote UNLOCK received from app.");
      Firebase.setString(fbData, cmdPath, "");
    }
  }

  // ── Crash Acknowledgement from Family App ──
  // When family clicks "Driver is OK", Firebase sets crashActive=false
  if (engineLockedDown) {
    String crashPath = vehiclePath + "/crashActive";
    if (Firebase.getBool(fbData, crashPath)) {
      if (!fbData.boolData()) {
        engineLockedDown = false;
        helmetData.crashDetected = false;
        Serial.println("[Crash] ✅ Acknowledged by app. Resuming normal mode.");
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Vehicle Unit Starting ===");

  // Pins — your original
  pinMode(keyPin,   INPUT_PULLUP);
  pinMode(motorIn1, OUTPUT);
  pinMode(motorIn2, OUTPUT);
  digitalWrite(motorIn1, LOW);
  digitalWrite(motorIn2, LOW);

  // GPS UART2
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("[GPS] UART2 started.");

  // SIM800L UART1 — your original
  simSerial.begin(9600, SERIAL_8N1, SIM_RX, SIM_TX);
  Serial.println("[SIM800L] UART1 started.");

  // ── WiFi: AP_STA mode (required so ESP-NOW works alongside WiFi) ──
  // AP_STA: the STA connects to your home router (for Firebase)
  //         the internal channel becomes shared with ESP-NOW
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("SmartVehicle_Config", "12345678", 0, 1);  
  // Channel 0 = auto-select; softAP is hidden (ssid_hidden=1, not used externally)

  Serial.println("[WiFi] Connecting to router...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] Channel: %d  ← Set ESPNOW_WIFI_CHANNEL to this in helmet_esp.ino\n",
                  WiFi.channel());
    Serial.printf("[WiFi] MAC: %s\n", WiFi.macAddress().c_str());
  } else {
    Serial.println("\n[WiFi] FAILED to connect! Firebase will not work.");
    Serial.println("       Check WIFI_SSID and WIFI_PASSWORD.");
  }

  // ── Firebase ──
  fbConfig.host = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  fbData.setResponseSize(4096);
  Serial.println("[Firebase] Initialized.");

  // ── ESP-NOW ──
  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init FAILED!");
  } else {
    esp_now_register_recv_cb(OnDataRecv);
    Serial.println("[ESP-NOW] Ready. Waiting for Helmet data...");
  }

  Serial.println("\n=== Vehicle Unit Online ===\n");
}

// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  // Feed GPS continuously
  while (gpsSerial.available() > 0) gps.encode(gpsSerial.read());

  unsigned long now = millis();

  // ── Engine control at 5Hz (your original 200ms interval) ──
  if (now - lastCheck >= 200) {
    lastCheck = now;
    bool isKeyIn = (digitalRead(keyPin) == LOW);  // your original logic

    // ── Engine Run Logic (your original condition) ──
    bool shouldRun = isKeyIn && !engineLocked && helmetData.helmetOn && !engineLockedDown;

    if (shouldRun) {
      digitalWrite(motorIn1, HIGH);
      digitalWrite(motorIn2, LOW);
    } else {
      digitalWrite(motorIn1, LOW);
      digitalWrite(motorIn2, LOW);
    }
  }

  // ── Push to Firebase every 2 seconds ──
  if (now - lastFirebasePush >= 2000) {
    lastFirebasePush = now;
    bool isKeyIn = (digitalRead(keyPin) == LOW);
    pushToFirebase(isKeyIn);
  }

  // ── Poll Firebase for remote commands every 1 second ──
  if (now - lastCommandPoll >= 1000) {
    lastCommandPoll = now;
    if (WiFi.status() == WL_CONNECTED) {
      pollFirebaseCommands();
    }
  }
}
