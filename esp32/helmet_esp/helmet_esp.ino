#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// ───── PIN ─────
const int irPin = 13;

// ───── CRASH THRESHOLD ─────
#define CRASH_ACCEL_THRESHOLD 20.0f

// ⚠️ MUST MATCH VEHICLE CHANNEL
#define ESPNOW_WIFI_CHANNEL 13

// ⚠️ MUST MATCH VEHICLE MAC
uint8_t vehicleAddress[] = {0xC8, 0x2E, 0x18, 0xF7, 0x48, 0xB4};

// ───── DATA STRUCT ─────
typedef struct struct_message {
  bool helmetOn;
  bool crashDetected;
} struct_message;

struct_message myData;
esp_now_peer_info_t peerInfo;
Adafruit_MPU6050 mpu;

bool crashReported = false;

// ───── DEBUG SEND STATUS ─────
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.printf("[ESP-NOW] Send: %s\n",
    status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAIL");
}

// ───────────────── SETUP ─────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=== HELMET UNIT STARTING ===");

  pinMode(irPin, INPUT);

  // MPU6050 init
  Wire.begin();
  if (!mpu.begin()) {
    Serial.println("[MPU6050] NOT FOUND!");
    while (1);
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  Serial.println("[MPU6050] Ready");

  // WiFi STA mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Lock channel
  esp_wifi_set_channel(ESPNOW_WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);

  // 🔥 DEBUG INFO (LIKE VEHICLE)
  Serial.println("===== HELMET INFO =====");
  Serial.printf("MAC: %s\n", WiFi.macAddress().c_str());
  Serial.printf("CHANNEL: %d\n", ESPNOW_WIFI_CHANNEL);
  Serial.println("========================");

  // ESP-NOW init
  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init FAILED!");
    while (1);
  }

  esp_now_register_send_cb(OnDataSent);

  // Add vehicle peer
  memcpy(peerInfo.peer_addr, vehicleAddress, 6);
  peerInfo.channel = ESPNOW_WIFI_CHANNEL;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("[ESP-NOW] Peer add FAILED!");
  } else {
    Serial.println("[ESP-NOW] Vehicle connected");
  }

  Serial.println("=== Helmet Ready (50ms send rate) ===\n");
}

// ───────────────── LOOP ─────────────────
void loop() {

  // Helmet detection
  myData.helmetOn = (digitalRead(irPin) == LOW);

  // MPU reading
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float accelMag = sqrt(
    a.acceleration.x * a.acceleration.x +
    a.acceleration.y * a.acceleration.y +
    a.acceleration.z * a.acceleration.z
  );

  // Crash detection
  if (accelMag > CRASH_ACCEL_THRESHOLD && !crashReported) {
    myData.crashDetected = true;
    crashReported = true;

    Serial.printf("🚨 CRASH DETECTED! Accel=%.2f\n", accelMag);
  } else if (!crashReported) {
    myData.crashDetected = false;
  }

  // Debug helmet status
  Serial.printf("Helmet: %s | Crash: %d\n",
    myData.helmetOn ? "ON" : "OFF",
    myData.crashDetected);

  // Send data
  esp_now_send(vehicleAddress, (uint8_t *)&myData, sizeof(myData));

  delay(50);  // ⚡ faster (20Hz)
}
