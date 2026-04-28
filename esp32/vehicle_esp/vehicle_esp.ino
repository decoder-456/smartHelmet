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
bool crashAcknowledged = false;

unsigned long lastFirebasePush = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastCheck = 0;

// ───────────────── FIREBASE ─────────────────
String firebaseBaseUrl = String("https://") + FIREBASE_HOST + "/vehicles/" + DRIVER_PHONE;
WiFiClientSecure client;
HTTPClient http;

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

  simSerial.println("AT+CMGF=1");
  delay(300);
  simSerial.print("AT+CMGS=\""); 
  simSerial.print(emergencyNumber); 
  simSerial.println("\"");
  delay(300);
  simSerial.print(smsText);
  delay(300);
  simSerial.write(26);
}

// ───────────────── ESP-NOW RECEIVE ─────────────────
void OnDataRecv(const esp_now_recv_info *info, const uint8_t *incomingData, int len) {
  memcpy(&helmetData, incomingData, sizeof(helmetData));

  if (helmetData.crashDetected && !engineLockedDown && !crashAcknowledged) {
    engineLockedDown = true;
    triggerEmergencyProtocol();
    pushToFirebase(digitalRead(keyPin) == LOW);
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

  http.begin(client, firebaseBaseUrl + ".json");
  http.addHeader("Content-Type", "application/json");
  http.PATCH(json);
  http.end();
}

// ───────────────── COMMAND POLL (OPTIMIZED) ─────────────────
void pollFirebaseCommands() {
  http.begin(client, firebaseBaseUrl + ".json");
  int code = http.GET();

  if (code == 200) {
    String payload = http.getString();
    
    // Handle Lock/Unlock
    if (payload.indexOf("\"pendingCommand\":\"lock\"") >= 0) {
      engineLocked = true;
      clearCommand();
    } else if (payload.indexOf("\"pendingCommand\":\"unlock\"") >= 0) {
      engineLocked = false;
      clearCommand();
    }

    // Handle Crash Acknowledgment
    if (engineLockedDown && payload.indexOf("\"crashActive\":false") >= 0) {
      engineLockedDown = false;
      crashAcknowledged = true;
      pushToFirebase(digitalRead(keyPin) == LOW);
    }
  }
  http.end();
}

void clearCommand() {
  http.begin(client, firebaseBaseUrl + "/pendingCommand.json");
  http.addHeader("Content-Type", "application/json");
  http.PUT("null");
  http.end();
  pushToFirebase(digitalRead(keyPin) == LOW);
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
  while (WiFi.status() != WL_CONNECTED) delay(300);

  client.setInsecure();
  http.setReuse(true); // Optimized for speed

  if (esp_now_init() == ESP_OK) esp_now_register_recv_cb(OnDataRecv);
}

// ───────────────── LOOP ─────────────────
void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  unsigned long now = millis();

  // Engine control (50ms)
  if (now - lastCheck >= 50) {
    lastCheck = now;
    bool keyIn = (digitalRead(keyPin) == LOW);
    bool run = keyIn && !engineLocked && helmetData.helmetOn && !engineLockedDown;
    digitalWrite(motorIn1, run);
    digitalWrite(motorIn2, LOW);
  }

  // Firebase update (1s)
  if (now - lastFirebasePush >= 1000) {
    lastFirebasePush = now;
    pushToFirebase(digitalRead(keyPin) == LOW);
  }

  // Poll commands (200ms)
  if (now - lastCommandPoll >= 200) {
    lastCommandPoll = now;
    if (WiFi.status() == WL_CONNECTED) pollFirebaseCommands();
  }
}
