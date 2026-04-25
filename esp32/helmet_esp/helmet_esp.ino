/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   SMART HELMET — ESP32 #1 : HELMET UNIT  (ESP-NOW Sender)      ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Original code preserved — only library + channel updated       ║
 * ║                                                                  ║
 * ║  Hardware:                                                       ║
 * ║    IR Sensor    → GPIO 13  (LOW = helmet on head)               ║
 * ║    MPU-6050     → SDA=21, SCL=22  (Adafruit library)           ║
 * ║                                                                  ║
 * ║  Communication:                                                  ║
 * ║    ESP-NOW → sends {helmetOn, crashDetected} to Vehicle ESP     ║
 * ║    (No WiFi router connection needed on this unit)               ║
 * ║                                                                  ║
 * ║  Libraries required:                                             ║
 * ║    • Adafruit MPU6050    (search "Adafruit MPU6050")            ║
 * ║    • Adafruit Unified Sensor (dependency, auto-installed)        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// ── Pin ───────────────────────────────────────────────────────────────────────
const int irPin = 13;

// ── Crash Threshold ───────────────────────────────────────────────────────────
// Total acceleration magnitude (m/s²). Gravity alone = ~9.8 m/s².
// 20 m/s² ≈ 2g — increase if getting false positives while riding.
#define CRASH_ACCEL_THRESHOLD  20.0f

// ── ESP-NOW Channel ───────────────────────────────────────────────────────────
// ⚠️  IMPORTANT: This MUST match the channel your home WiFi router uses.
// Common values: 1, 6, or 11. Check your router admin page if unsure.
// The Vehicle ESP will print its channel to Serial on boot.
#define ESPNOW_WIFI_CHANNEL  1

// ── Vehicle ESP MAC Address ───────────────────────────────────────────────────
// ⚠️  Replace with YOUR Vehicle ESP32 MAC (printed on Serial at boot)
uint8_t vehicleAddress[] = {0xC8, 0x2E, 0x18, 0xF7, 0x48, 0xB4};

// ── Data Packet (must match struct in vehicle_esp.ino) ────────────────────────
typedef struct struct_message {
  bool helmetOn;
  bool crashDetected;
} struct_message;

struct_message myData;
esp_now_peer_info_t peerInfo;
Adafruit_MPU6050 mpu;

bool crashReported = false;

// ── Optional: send callback for debugging ─────────────────────────────────────
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  // Uncomment for debugging:
  // Serial.printf("[ESP-NOW] Send: %s\n", status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAIL");
}

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Helmet Unit Starting ===");

  pinMode(irPin, INPUT);

  // MPU-6050
  Wire.begin();
  if (!mpu.begin()) {
    Serial.println("[MPU6050] NOT FOUND — check wiring! (SDA=21, SCL=22)");
    while (1) delay(100);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("[MPU6050] Ready.");

  // ESP-NOW setup — STA mode, no router connection needed
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Lock to the specific channel so ESP-NOW reaches Vehicle ESP
  esp_wifi_set_channel(ESPNOW_WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
  Serial.printf("[WiFi] ESP-NOW channel locked to: %d\n", ESPNOW_WIFI_CHANNEL);
  Serial.printf("[WiFi] This unit MAC: %s\n", WiFi.macAddress().c_str());

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init FAILED!");
    while (1) delay(100);
  }

  esp_now_register_send_cb(OnDataSent);

  memcpy(peerInfo.peer_addr, vehicleAddress, 6);
  peerInfo.channel = ESPNOW_WIFI_CHANNEL;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("[ESP-NOW] Failed to add Vehicle peer.");
  } else {
    Serial.println("[ESP-NOW] Vehicle peer registered.");
  }

  Serial.println("=== Helmet Unit Ready. Sending every 100ms. ===\n");
}

// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  // ── 1. Helmet Detection (IR Sensor) ──
  myData.helmetOn = (digitalRead(irPin) == LOW);

  // ── 2. Crash Detection (MPU-6050) ──
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Total acceleration magnitude (includes gravity ~9.8 m/s²)
  float accelMag = sqrt(
    pow(a.acceleration.x, 2) +
    pow(a.acceleration.y, 2) +
    pow(a.acceleration.z, 2)
  );

  if (accelMag > CRASH_ACCEL_THRESHOLD && !crashReported) {
    myData.crashDetected = true;
    crashReported = true;
    Serial.printf("[CRASH] Impact detected! Accel=%.2f m/s²\n", accelMag);
  } else if (!crashReported) {
    myData.crashDetected = false;
  }
  // Note: crashReported latches to true until reset (power cycle)
  // The vehicle ESP will notify the cloud; family app acknowledges it

  // ── 3. Send via ESP-NOW ──
  esp_now_send(vehicleAddress, (uint8_t *)&myData, sizeof(myData));

  delay(100);   // Send 10 times per second
}
