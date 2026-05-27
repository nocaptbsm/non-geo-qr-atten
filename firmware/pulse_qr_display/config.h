// ============================================================
//  Pulse.QR — ESP32 + TFT QR Display  |  Configuration
// ============================================================
#ifndef CONFIG_H
#define CONFIG_H

// ─── WiFi ────────────────────────────────────────────────────
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASS       "YOUR_WIFI_PASSWORD"
#define WIFI_TIMEOUT_MS 15000

// ─── Server URLs ─────────────────────────────────────────────
// Frontend URL: the QR will encode FRONTEND_URL "/scan/" + token
#define FRONTEND_URL    "https://your-app.vercel.app"

// Backend API base URL (include /api).
// Leave as "" to use offline self-generated tokens.
#define BACKEND_URL     ""

// Device identifier sent to the backend
#define DEVICE_ID       "ESP32-01"

// ─── Token timing ────────────────────────────────────────────
#define TOKEN_TTL_SEC   15
#define TOKEN_TTL_MS    (TOKEN_TTL_SEC * 1000UL)

// ─── TFT Pin wiring (ESP32 → ILI9341 2.4″ 240×320) ─────────
//   MOSI = GPIO 23, SCK = GPIO 18  (default VSPI)
#define TFT_CS_PIN      5
#define TFT_DC_PIN      2
#define TFT_RST_PIN     4
#define TFT_BL_PIN      15    // backlight, set -1 to skip

// ─── Display ─────────────────────────────────────────────────
#define SCREEN_W        240
#define SCREEN_H        320
#define QR_PIXEL_SIZE   5

// ─── NTP ─────────────────────────────────────────────────────
#define NTP_SERVER      "pool.ntp.org"
#define GMT_OFFSET_SEC  19800   // IST +5:30
#define DST_OFFSET_SEC  0

#endif
