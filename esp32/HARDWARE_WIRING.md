# Smart Helmet — Hardware Wiring Reference

## System Architecture

```
┌──────────────────────────┐  ESP-NOW (wireless)   ┌──────────────────────────────────┐
│   ESP32 #1 — HELMET      │ ─────────────────────► │   ESP32 #2 — VEHICLE             │
│                          │  {helmetOn,            │                                  │
│  IR Sensor  → GPIO 13   │   crashDetected}        │  GPS Module → UART2 (RX16,TX17) │
│  MPU-6050   → I2C        │                         │  SIM800L    → UART1 (RX32,TX33) │
│                          │                         │  Motor IN1  → GPIO 26            │
│  No WiFi connection      │                         │  Motor IN2  → GPIO 27            │
│  needed (ESP-NOW only)   │                         │  Key Pin    → GPIO 4 + GND       │
└──────────────────────────┘                         │  WiFi STA   → Home Router        │
                                                     │  Firebase   → Cloud DB           │
                                 App (lock/unlock) ──►  pendingCommand read from Firebase│
                                 App (monitoring)  ◄── status, lat, lng, helmetOn pushed │
                                 SMS Alert         ──► SIM800L sends crash SMS           │
                                                     └──────────────────────────────────┘
```

---

## ESP32 #1 — Helmet Unit

### Pin Connections

| Component       | ESP32 Pin  | Notes                                        |
|-----------------|------------|----------------------------------------------|
| IR Sensor OUT   | GPIO **13** | `LOW` = helmet on head (object detected)     |
| IR Sensor VCC   | 3.3V       |                                              |
| IR Sensor GND   | GND        |                                              |
| MPU-6050 SDA    | GPIO **21** | I2C Data (default)                          |
| MPU-6050 SCL    | GPIO **22** | I2C Clock (default)                         |
| MPU-6050 VCC    | 3.3V       |                                              |
| MPU-6050 GND    | GND        |                                              |
| MPU-6050 AD0    | GND        | Sets I2C address to 0x68                     |

### Libraries (Arduino Library Manager)
```
1. Adafruit MPU6050          (search: "Adafruit MPU6050")
2. Adafruit Unified Sensor   (auto-installed as dependency)
```

### Crash Detection
- Threshold: **20 m/s²** (≈ 2g). Tune `CRASH_ACCEL_THRESHOLD` in code.
- Gravity alone = 9.8 m/s², so any impact > ~10 m/s² above gravity triggers it.
- `crashReported` latches `true` until power cycle. The Family App's "Acknowledge" button resets it on the Firebase side.

### ⚠️ ESP-NOW Channel Setup
The Helmet ESP must use the **same WiFi channel** as your home router (not your local WiFi password — just the *channel number*).

**Steps:**
1. Flash and boot the **Vehicle ESP first**
2. Watch its Serial monitor — it will print:
   ```
   [WiFi] Channel: 6  ← Set ESPNOW_WIFI_CHANNEL to this in helmet_esp.ino
   ```
3. Open `helmet_esp.ino`, set `#define ESPNOW_WIFI_CHANNEL 6` (or whatever it printed)
4. Flash the Helmet ESP

---

## ESP32 #2 — Vehicle Unit

### Pin Connections

| Component         | ESP32 Pin   | Notes                                             |
|-------------------|-------------|---------------------------------------------------|
| Key Pin           | GPIO **4**  | Connect GPIO4 → GND = key in ignition             |
| Motor Driver IN1  | GPIO **26** | HIGH = engine runs (forward)                      |
| Motor Driver IN2  | GPIO **27** | HIGH = engine locked (reverse/brake)              |
| GPS TX (module)   | GPIO **16** | GPS TX → ESP32 RX2                               |
| GPS RX (module)   | GPIO **17** | GPS RX → ESP32 TX2                               |
| GPS VCC           | 3.3V or 5V  | Check your GPS module spec                        |
| GPS GND           | GND         |                                                   |
| SIM800L TX        | GPIO **32** | SIM TX → ESP32 RX1                               |
| SIM800L RX        | GPIO **33** | SIM RX → ESP32 TX1                               |
| SIM800L VCC       | 3.7V–4.2V  | ⚠️  Needs its own supply (≥2A) — NOT from 3.3V   |
| SIM800L GND       | GND (common)|                                                   |

### Key Ignition Pin
```
Key OUT:  GPIO4 ─── [disconnected] ───  reads HIGH  →  engine cannot run
Key IN:   GPIO4 ─────────── GND     →  reads LOW   →  engine can run (if helmet on + not locked)
```

### Engine Run Condition (exact from your original code)
```
shouldRun = isKeyIn && !engineLocked && helmetData.helmetOn && !engineLockedDown
```
| Condition       | Meaning                                |
|-----------------|----------------------------------------|
| `isKeyIn`       | GPIO4 connected to GND                 |
| `!engineLocked` | App has NOT sent remote lock command   |
| `helmetData.helmetOn` | Helmet is being worn              |
| `!engineLockedDown`   | No crash detected                 |

### Libraries (Arduino Library Manager)
```
1. Firebase ESP32 Client  by mobizt  (search: "firebase esp32 mobizt")
2. TinyGPS++              by Mikal Hart  (search: "TinyGPS++")
```

---

## Firebase Data Structure Written by Vehicle ESP

```
vehicles/
  "6200071174"/          ← DRIVER_PHONE (digits only)
    status:     "IDLE"   ← "IDLE" | "DRIVING" | "LOCKED" | "CRASH"
    helmetOn:   true     ← mirrored from Helmet ESP via ESP-NOW
    crashActive: false   ← true when crash detected
    keyIn:      true     ← GPIO4 connected to GND
    lat:        22.7766  ← from GPS module
    lng:        86.1437  ← from GPS module
    timestamp:  1234567  ← millis()
    pendingCommand: ""   ← "lock" or "unlock" written by Driver App → read here
```

---

## SIM800L Emergency SMS

- Triggered automatically when Helmet ESP sends `crashDetected=true` via ESP-NOW
- SMS sent to `+917992202784` (change `emergencyNumber` in code)
- Message includes Google Maps link with live GPS coordinates
- Fallback coordinates (NIT Jamshedpur: 22.7766, 86.1437) used if GPS not fixed

> **SIM800L Power Note:** The module needs **3.7V–4.2V at 2A peak**. Using 3.3V or powering from the ESP's 3.3V pin will cause random resets or SMS failures. Use a LiPo battery or dedicated regulator.

---

## Arduino IDE Board Settings (both ESPs)

```
Board:          ESP32 Dev Module
Upload Speed:   115200
CPU Frequency:  240MHz
Flash Size:     4MB (Scheme: Default 4MB with spiffs)
```

---

## Setup Order

1. Flash **Vehicle ESP** first → note the WiFi channel from Serial monitor
2. Set `ESPNOW_WIFI_CHANNEL` in `helmet_esp.ino` to match
3. Flash **Helmet ESP**
4. Boot both — check Serial monitors
5. Open Driver App → Register with phone number matching `DRIVER_PHONE`
6. Use the **Simulator page** (`/simulator`) or the actual hardware to send test data
7. Open Family App → Register with the driver's phone as linkedPhone
8. Test crash flow: shake helmet hard → SMS + Firebase `crashActive=true` → Family App shows crash modal
