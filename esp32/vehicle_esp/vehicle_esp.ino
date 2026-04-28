#include <esp_now.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <TinyGPSPlus.h>

// ── Function Prototypes (Fixes 'not declared in this scope' error) ──
void pushToFirebase(bool keyIn, bool force = false);
void clearCommand();
void pollFirebaseCommands();
void handleCrash();

// ───────────────── CONFIG ─────────────────
#define WIFI_SSID       "Redmi 13C 5G"
#define WIFI_PASSWORD   "123456789"
#define FIREBASE_HOST   "smarthelmet-961f1-default-rtdb.firebaseio.com"
#define DRIVER_PHONE    "6200071174"

// ───────────────── PINS ─────────────────
const int keyPin    = 4;
const int motorIn1  = 26;
const int motorIn2  = 27;
#define GPS_RX 16
#define GPS_TX 17

// ───────────────── STRUCT ─────────────────
typedef struct struct_message {
  bool helmetOn;
  bool crashDetected;
} struct_message;

struct_message helmetData;

// ───────────────── STATE ─────────────────
bool engineLocked = false;
bool engineLockedDown = false;
bool crashAcknowledged = false;

// Status Cache for Smart Pushing
String lastStatus = "";
bool lastHelmet = false;
bool lastKey = false;

unsigned long lastFirebasePush = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastCheck = 0;

// ───────────────── FIREBASE ─────────────────
String firebaseBaseUrl = String("https://") + FIREBASE_HOST + "/vehicles/" + DRIVER_PHONE;
WiFiClientSecure client;
HTTPClient http;

// ───────────────── GPS ─────────────────
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// ───────────────── EMERGENCY ─────────────────
void handleCrash() {
  digitalWrite(motorIn1, LOW);
  digitalWrite(motorIn2, LOW);
  Serial.println("🚨 EMERGENCY ENGINE KILL");
}

// ───────────────── ESP-NOW RECEIVE ─────────────────
void OnDataRecv(const esp_now_recv_info *info, const uint8_t *incomingData, int len) {
  memcpy(&helmetData, incomingData, sizeof(helmetData));

  if (helmetData.crashDetected && !engineLockedDown && !crashAcknowledged) {
    engineLockedDown = true;
    handleCrash();
    pushToFirebase(digitalRead(keyPin) == LOW, true); // Force push on crash
  }
}

// ───────────────── FIREBASE PUSH (SMART) ─────────────────
void pushToFirebase(bool keyIn, bool force = false) {
  String status;
  if (engineLockedDown) status = "CRASH";
  else if (engineLocked) status = "LOCKED";
  else if (keyIn && helmetData.helmetOn) status = "DRIVING";
  else status = "IDLE";

  // Only push if data changed or forced (e.g. heartbeat every 5s)
  if (!force && status == lastStatus && keyIn == lastKey && helmetData.helmetOn == lastHelmet) {
    if (millis() - lastFirebasePush < 5000) return; 
  }

  lastStatus = status; lastKey = keyIn; lastHelmet = helmetData.helmetOn;
  lastFirebasePush = millis();

  String json = "{";
  json += "\"status\":\"" + status + "\",";
  json += "\"helmetOn\":" + String(helmetData.helmetOn ? "true" : "false") + ",";
  json += "\"crashActive\":" + String(engineLockedDown ? "true" : "false") + ",";
  json += "\"keyIn\":" + String(keyIn ? "true" : "false") + ",";
  json += "\"timestamp\":" + String(millis());
  if (gps.location.isValid()) {
    json += ",\"lat\":" + String(gps.location.lat(), 6);
    json += ",\"lng\":" + String(gps.location.lng(), 6);
  }
  json += "}";

  http.begin(client, firebaseBaseUrl + ".json");
  http.addHeader("Content-Type", "application/json");
  http.PATCH(json);
  http.end();
}

// ───────────────── COMMAND POLL (FAST 10Hz) ─────────────────
void pollFirebaseCommands() {
  http.begin(client, firebaseBaseUrl + ".json");
  int code = http.GET();

  if (code == 200) {
    String payload = http.getString();
    
    // Check Commands
    if (payload.indexOf("\"pendingCommand\":\"lock\"") >= 0) {
      engineLocked = true;
      Serial.println("🔒 LOCKED");
      clearCommand();
    } else if (payload.indexOf("\"pendingCommand\":\"unlock\"") >= 0) {
      engineLocked = false;
      Serial.println("🔓 UNLOCKED");
      clearCommand();
    }

    // Check Crash Ack
    if (engineLockedDown && payload.indexOf("\"crashActive\":false") >= 0) {
      engineLockedDown = false;
      crashAcknowledged = true;
      Serial.println("✅ CRASH CLEARED");
      pushToFirebase(digitalRead(keyPin) == LOW, true);
    }
  }
  http.end();
}

void clearCommand() {
  http.begin(client, firebaseBaseUrl + "/pendingCommand.json");
  http.addHeader("Content-Type", "application/json");
  http.PUT("null");
  http.end();
  pushToFirebase(digitalRead(keyPin) == LOW, true);
}

// ───────────────── SETUP ─────────────────
void setup() {
  Serial.begin(115200);
  pinMode(keyPin, INPUT_PULLUP);
  pinMode(motorIn1, OUTPUT);
  pinMode(motorIn2, OUTPUT);

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(200);

  client.setInsecure();
  http.setReuse(true); // Persist connection

  if (esp_now_init() == ESP_OK) esp_now_register_recv_cb(OnDataRecv);
  Serial.println("🚀 High-Speed Mode Active");
}

// ───────────────── LOOP ─────────────────
void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  unsigned long now = millis();

  // Engine Control (50ms)
  if (now - lastCheck >= 50) {
    lastCheck = now;
    bool keyIn = (digitalRead(keyPin) == LOW);
    bool run = keyIn && !engineLocked && helmetData.helmetOn && !engineLockedDown;
    digitalWrite(motorIn1, run);
    digitalWrite(motorIn2, LOW);
  }

  // Smart Push (Dynamic)
  pushToFirebase(digitalRead(keyPin) == LOW);

  // Command Poll (100ms)
  if (now - lastCommandPoll >= 100) {
    lastCommandPoll = now;
    if (WiFi.status() == WL_CONNECTED) pollFirebaseCommands();
  }
}
