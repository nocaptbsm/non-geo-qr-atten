// ============================================================
//  Pulse.QR — ESP32 + TFT QR Display  |  Configuration
// ============================================================
#ifndef CONFIG_H
#define CONFIG_H

// ─── WiFi ────────────────────────────────────────────────────
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASS       "YOUR_WIFI_PASSWORD"
#define WIFI_TIMEOUT_MS 15000   // give up connecting after 15 s

// ─── Server URLs ─────────────────────────────────────────────
// Frontend URL used to build the QR scan link:
//   e.g. https://your-vercel-app.vercel.app
//   The QR will encode: FRONTEND_URL "/scan/" + token
#define FRONTEND_URL    "https://your-app.vercel.app"

// Backend API base URL (with /api prefix).
// Set to "" to use offline / self-generated tokens.
//   e.g. https://your-backend.onrender.com/api
#define BACKEND_URL     ""

// Device identifier sent to the backend
#define DEVICE_ID       "ESP32-01"

// ─── Token timing ────────────────────────────────────────────
#define TOKEN_TTL_SEC   15      // rotate QR every N seconds
#define TOKEN_TTL_MS    (TOKEN_TTL_SEC * 1000UL)

// ─── TFT Pin wiring (ESP32 → ILI9341 2.4″ 240×320) ─────────
// Using hardware SPI (VSPI):
//   MOSI = GPIO 23  (default VSPI)
//   SCK  = GPIO 18  (default VSPI)
#define TFT_CS          5
#define TFT_DC          2
#define TFT_RST         4
#define TFT_BL          15     // backlight pin (PWM), -1 to skip

// ─── Display geometry ────────────────────────────────────────
#define SCREEN_W        240
#define SCREEN_H        320

// QR module pixel size — sets how large the QR is on screen.
// Version 6 QR (41 modules) × 5 px = 205 px which fits 240 nicely.
#define QR_PIXEL_SIZE   5

// ─── NTP (for offline token generation) ──────────────────────
#define NTP_SERVER      "pool.ntp.org"
#define GMT_OFFSET_SEC  19800  // IST = +5:30 = 19800
#define DST_OFFSET_SEC  0

#endif // CONFIG_H
