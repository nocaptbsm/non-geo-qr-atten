# Pulse.QR — ESP32 Firmware

Complete firmware for displaying dynamic, rotating QR attendance codes on a **2.4″ ILI9341 TFT** (240×320) driven by an **ESP32**.

---

## 📦 Hardware Required

| Component | Specification |
|-----------|--------------|
| ESP32 Dev Board | Any variant with SPI (DevKitC, NodeMCU-32S, etc.) |
| TFT Display | 2.4″ ILI9341, 240×320, SPI interface |
| Jumper wires | Female-to-female (7 wires) |

### Wiring Diagram

```
ESP32          ILI9341 TFT
─────          ───────────
GPIO 23  ───►  SDA  (MOSI)
GPIO 18  ───►  SCL  (SCK)
GPIO  5  ───►  CS
GPIO  2  ───►  DC (A0)
GPIO  4  ───►  RST (RESET)
GPIO 15  ───►  LED (Backlight)
3.3V     ───►  VCC
GND      ───►  GND
```

> ⚠️ **Important**: Use **3.3V**, not 5V. The ILI9341 runs at 3.3V logic level.

---

## 🛠️ Software Setup

### 1. Install Arduino IDE
Download from [arduino.cc](https://www.arduino.cc/en/software) (v2.x recommended).

### 2. Add ESP32 Board Support
1. Go to **File → Preferences**
2. In "Additional Board Manager URLs", add:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. Go to **Tools → Board → Board Manager**
4. Search "esp32" and install **esp32 by Espressif Systems**

### 3. Install Libraries
Go to **Sketch → Include Library → Manage Libraries** and install:

| Library | Author | Version |
|---------|--------|---------|
| **TFT_eSPI** | Bodmer | Latest |
| **qrcode** | Richard Moore | Latest |
| **ArduinoJson** | Benoît Blanchon | v7.x |

### 4. Configure TFT_eSPI

This is the **most critical step**. You must edit the TFT_eSPI configuration file:

1. Find the file at:
   ```
   <Arduino Libraries>/TFT_eSPI/User_Setup.h
   ```
   - **macOS**: `~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h`
   - **Windows**: `C:\Users\<You>\Documents\Arduino\libraries\TFT_eSPI\User_Setup.h`
   - **Linux**: `~/Arduino/libraries/TFT_eSPI/User_Setup.h`

2. Open it and make sure these lines are **uncommented** (remove `//`):

   ```c
   #define ILI9341_DRIVER

   #define TFT_CS    5
   #define TFT_DC    2
   #define TFT_RST   4
   #define TFT_MOSI  23
   #define TFT_SCLK  18

   #define SPI_FREQUENCY  40000000
   ```

3. Make sure **all other driver defines** (`ST7735_DRIVER`, `ILI9163_DRIVER`, etc.) are **commented out**.

### 5. Configure the Firmware

Edit `config.h`:

```c
// Your WiFi credentials
#define WIFI_SSID       "MyHomeWiFi"
#define WIFI_PASS       "MyPassword123"

// Your deployed Vercel frontend URL
#define FRONTEND_URL    "https://your-app.vercel.app"

// (Optional) Your backend API URL — leave "" for offline mode
#define BACKEND_URL     "https://your-backend.onrender.com/api"
```

### 6. Upload

1. Open `pulse_qr_display.ino` in Arduino IDE
2. Select **Tools → Board → ESP32 Dev Module**
3. Select the correct **Port** (your ESP32's serial port)
4. Set **Upload Speed** to `921600`
5. Click **Upload** (→)

---

## 🔄 How It Works

```
┌─────────────────────────────────────────────┐
│                  BOOT                       │
│  1. Show splash screen                      │
│  2. Connect to WiFi                         │
│  3. Sync NTP clock                          │
│  4. Generate first token                    │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│              MAIN LOOP                      │
│                                             │
│  Every 15 seconds:                          │
│    ┌─ Try backend API (if WiFi + URL set)   │
│    │    GET /api/generate-token?deviceId=... │
│    │    → { token: "abc123..." }             │
│    │                                        │
│    └─ Fallback: self-generate token         │
│         Format: t_<base36_expiry>_<rand6>   │
│                                             │
│  Build URL: FRONTEND_URL/scan/<token>       │
│  Render QR code on TFT                      │
│  Animate countdown bar (15s → 0s)           │
└─────────────────────────────────────────────┘
```

### Token Modes

| Mode | When | Token Source |
|------|------|-------------|
| **Online** | WiFi connected + `BACKEND_URL` set | Backend API `GET /api/generate-token` |
| **Offline** | WiFi down or `BACKEND_URL` empty | Self-generated, matches frontend format |

**Offline tokens** use the exact same format (`t_<base36_expiryMs>_<random6>`) as the frontend's `generateToken()` in `src/lib/store.ts`, so scanning works seamlessly even without the backend.

---

## 📱 User Flow

1. **ESP32** displays a QR code on the TFT
2. **User** scans QR with phone camera
3. Phone opens `https://your-app.vercel.app/scan/<token>`
4. **Frontend** validates the token (freshness + single-use)
5. User enters registration number → attendance marked
6. QR on ESP32 rotates to a new code every 15 seconds

---

## 🖥️ Display Layout

```
┌──────────────────────────────┐
│ PULSE.QR          ESP32-01   │  ← Header
│ ESP32  LIVE              🟢  │  ← WiFi dot
│──────────────────────────────│
│      SCAN TO CHECK IN        │
│                              │
│    ┌──────────────────────┐  │
│    │                      │  │
│    │    ██ ██ █ ██ █      │  │
│    │    █ ████ ██ █       │  │
│    │    ██  █ ██  ██      │  │  ← QR Code
│    │    █ █ ██ ██ █       │  │     (white bg)
│    │    ██ █ █ ██ █       │  │
│    │                      │  │
│    └──────────────────────┘  │
│                              │
│ ████████████████░░░░░░░░     │  ← Countdown bar
│            8s                │  ← Seconds left
│     t_lk3f8n2_a7xp...       │  ← Token (truncated)
└──────────────────────────────┘
```

---

## ❓ Troubleshooting

| Symptom | Fix |
|---------|-----|
| **White/blank screen** | Check `User_Setup.h` in TFT_eSPI — wrong driver or pins |
| **Garbled display** | Verify SPI wiring, especially MOSI/SCK/CS |
| **"WiFi failed"** | Check SSID/password in `config.h`. Move closer to router. |
| **QR won't scan** | Token may be expired. The 15s TTL is strict. Try right after rotation. |
| **"Token expired" on phone** | NTP might not have synced. Check serial monitor. |
| **Backend API fails** | Verify `BACKEND_URL` is correct and server is running. Falls back to offline mode automatically. |
| **Compile error: TFT_eSPI** | Make sure you edited `User_Setup.h`, not `User_Setup_Select.h` |

### Serial Monitor

Open **Tools → Serial Monitor** at **115200 baud** to see debug output:
```
[Pulse.QR] Booting ESP32 QR Display...
[WiFi] Connecting to MyWiFi...
[WiFi] Connected! IP: 192.168.1.42
[NTP] Time: 2026-05-27 19:33:00
[Token] t_lk3f8n2q_a7xp3k
[QR] URL: https://your-app.vercel.app/scan/t_lk3f8n2q_a7xp3k
```

---

## 📁 File Structure

```
firmware/
├── pulse_qr_display.ino   ← Main firmware (open this in Arduino IDE)
├── config.h                ← WiFi, URLs, pins, timing
└── README.md               ← This file
```
