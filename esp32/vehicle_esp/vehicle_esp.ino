#include <esp_now.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <TinyGPSPlus.h>

// ───────────────── CONFIG ─────────────────
#define WIFI_SSID       "Redmi 13C 5G"
#define WIFI_PASSWORD   "123456789"
#define FIREBASE_HOST   "smarthelmet-961f1-default-rtdb.firebaseio.com"
#define DRIVER_PHONE    "6200071174"

String emergencyNumber = "+917992202784";

// ───────────────── PINS ─────────────────
const int keyPin    = 4;
const int motorIn1  = 26;
const int motorIn2  = 27;

#define GPS_RX 16
#define GPS_TX 17
#define SIM_RX 32
#define SIM_TX 33

// ───────────────── STRUCT ─────────────────
typedef struct struct_message {
  bool helmetOn;
  bool crashDetected;
} struct_message;

struct_message helmetData;

// ───────────────── STATE ─────────────────
bool engineLocked = false;
bool engineLockedDown = false;
bool crashAcknowledged = false; // Prevents immediate re-trigger from latched helmet signal

unsigned long lastFirebasePush = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastCheck = 0;

// ───────────────── FIREBASE ─────────────────
String firebaseBaseUrl = String("https://") + FIREBASE_HOST + "/vehicles/" + DRIVER_PHONE;

// ───────────────── GPS + SIM ─────────────────
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
HardwareSerial simSerial(1);

// ───────────────── SMS ─────────────────
void triggerEmergencyProtocol() {
  digitalWrite(motorIn1, LOW);
  digitalWrite(motorIn2, LOW);

  String smsText = "URGENT: Crash Detected! Location: ";
  if (gps.location.isValid()) {
    smsText += "https://maps.google.com/?q=" +
               String(gps.location.lat(), 6) + "," +
               String(gps.location.lng(), 6);
  } else {
    smsText += "Location unavailable";
  }

  Serial.println("[SIM800] Sending SMS...");

  simSerial.println("AT+CMGF=1");
  delay(300);
  simSerial.print("AT+CMGS=\""); 
  simSerial.print(emergencyNumber); 
  simSerial.println("\"");
  delay(300);
  simSerial.print(smsText);
  delay(300);
  simSerial.write(26);

  Serial.println("[SIM800] SMS Sent!");
}

// ───────────────── ESP-NOW RECEIVE ─────────────────
void OnDataRecv(const esp_now_recv_info *info, const uint8_t *incomingData, int len) {
  memcpy(&helmetData, incomingData, sizeof(helmetData));

  // Only trigger if crash is detected AND we haven't already acknowledged this crash session
  if (helmetData.crashDetected && !engineLockedDown && !crashAcknowledged) {
    engineLockedDown = true;
    Serial.println("\n🚨 CRASH DETECTED!");

    triggerEmergencyProtocol();

    // Instant Firebase update
    bool keyIn = (digitalRead(keyPin) == LOW);
    pushToFirebase(keyIn);
  }
}

// ───────────────── FIREBASE PUSH ─────────────────
void pushToFirebase(bool keyIn) {
  String status;

  if (engineLockedDown) status = "CRASH";
  else if (engineLocked) status = "LOCKED";
  else if (keyIn && helmetData.helmetOn) status = "DRIVING";
  else status = "IDLE";

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

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  http.begin(client, firebaseBaseUrl + ".json");
  http.addHeader("Content-Type", "application/json");
  int code = http.PATCH(json);

  if (code > 0) {
    Serial.printf("[Firebase] Updated: %s\n", status.c_str());
  } else {
    Serial.println("[Firebase] Error!");
  }

  http.end();
}

// ───────────────── COMMAND POLL ─────────────────
void pollFirebaseCommands() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // ── Remote Lock/Unlock ──
  String url = firebaseBaseUrl + "/pendingCommand.json";
  http.begin(client, url);
  int code = http.GET();

  if (code == 200) {
    String payload = http.getString();
    payload.replace("\"", "");
    payload.trim();

    if (payload == "lock") {
      engineLocked = true;
      Serial.println("🔒 LOCKED");
      
      http.end();
      http.begin(client, url);
      http.addHeader("Content-Type", "application/json");
      http.PUT("null");
      http.end();

      bool keyIn = (digitalRead(keyPin) == LOW);
      pushToFirebase(keyIn);
    } 
    else if (payload == "unlock") {
      engineLocked = false;
      Serial.println("🔓 UNLOCKED");

      http.end();
      http.begin(client, url);
      http.addHeader("Content-Type", "application/json");
      http.PUT("null");
      http.end();

      bool keyIn = (digitalRead(keyPin) == LOW);
      pushToFirebase(keyIn);
    }
  }
  http.end();

  // ── Crash Acknowledgement ──
  if (engineLockedDown) {
    String crashUrl = firebaseBaseUrl + "/crashActive.json";
    http.begin(client, crashUrl);
    int crashCode = http.GET();
    if (crashCode == 200) {
      String crashPayload = http.getString();
      crashPayload.trim();
      if (crashPayload == "false") {
        engineLockedDown = false;
        crashAcknowledged = true; // Block re-trigger until helmet is reset
        Serial.println("[Crash] ✅ Acknowledged. Resuming...");
      }
    }
    http.end();
  }
}

// ───────────────── SETUP ─────────────────
void setup() {
  Serial.begin(115200);

  pinMode(keyPin, INPUT_PULLUP);
  pinMode(motorIn1, OUTPUT);
  pinMode(motorIn2, OUTPUT);

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  simSerial.begin(9600, SERIAL_8N1, SIM_RX, SIM_TX);

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }

  Serial.println("\nConnected!");

  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(OnDataRecv);
    Serial.println("[ESP-NOW] Ready");
  } else {
    Serial.println("[ESP-NOW] Failed!");
  }
}

// ───────────────── LOOP ─────────────────
void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  unsigned long now = millis();

  // Fast engine control
  if (now - lastCheck >= 50) {
    lastCheck = now;

    bool keyIn = (digitalRead(keyPin) == LOW);
    bool run = keyIn && !engineLocked && helmetData.helmetOn && !engineLockedDown;

    digitalWrite(motorIn1, run);
    digitalWrite(motorIn2, LOW);
  }

  // Fast Firebase update
  if (now - lastFirebasePush >= 500) {
    lastFirebasePush = now;
    bool keyIn = (digitalRead(keyPin) == LOW);
    pushToFirebase(keyIn);
  }

  // Fast command response
  if (now - lastCommandPoll >= 200) {
    lastCommandPoll = now;
    if (WiFi.status() == WL_CONNECTED) {
      pollFirebaseCommands();
    }
  }
}
