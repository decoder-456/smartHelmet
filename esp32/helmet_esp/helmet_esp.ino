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
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 50; // 20Hz

// ───── SEND CALLBACK ─────
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  // Silent in high-speed mode unless there's an error
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.println("![ESP-NOW] Send FAIL");
  }
}

// ───────────────── SETUP ─────────────────
void setup() {
  Serial.begin(115200);
  pinMode(irPin, INPUT);

  Wire.begin();
  if (!mpu.begin()) {
    Serial.println("[MPU6050] Not Found!");
    while (1);
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(ESPNOW_WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);

  if (esp_now_init() != ESP_OK) while (1);

  esp_now_register_send_cb(OnDataSent);

  memcpy(peerInfo.peer_addr, vehicleAddress, 6);
  peerInfo.channel = ESPNOW_WIFI_CHANNEL;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  Serial.println("🚀 Helmet High-Speed Active");
}

// ───────────────── LOOP ─────────────────
void loop() {
  // 1. Instant Sensor Reading
  myData.helmetOn = (digitalRead(irPin) == LOW);

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float accelMag = sqrt(
    a.acceleration.x * a.acceleration.x +
    a.acceleration.y * a.acceleration.y +
    a.acceleration.z * a.acceleration.z
  );

  // 2. Instant Crash Detection
  if (accelMag > CRASH_ACCEL_THRESHOLD && !crashReported) {
    myData.crashDetected = true;
    crashReported = true;
    Serial.printf("🚨 CRASH! Accel=%.2f\n", accelMag);
    // Force immediate send on crash
    esp_now_send(vehicleAddress, (uint8_t *)&myData, sizeof(myData));
  } else if (!crashReported) {
    myData.crashDetected = false;
  }

  // 3. Timed Regular Updates (Non-blocking)
  unsigned long now = millis();
  if (now - lastSendTime >= sendInterval) {
    lastSendTime = now;
    esp_now_send(vehicleAddress, (uint8_t *)&myData, sizeof(myData));
  }
}
