/*
 * ============================================================
 *  Pulse.QR — ESP32 Dynamic QR Attendance Display
 * ============================================================
 *
 *  Hardware:
 *    • ESP32 Dev Module (any variant with SPI)
 *    • 2.4″ ILI9341 TFT (240×320), SPI interface
 *
 *  Libraries required (install via Arduino Library Manager):
 *    1. TFT_eSPI   — fast TFT driver   (by Bodmer)
 *    2. qrcode     — QR generation      (by Richard Moore)
 *    3. ArduinoJson — JSON parsing       (by Benoît Blanchon)
 *    4. WiFi, HTTPClient, time.h        — built-in ESP32
 *
 *  IMPORTANT — TFT_eSPI setup:
 *    Before compiling, edit the file
 *       <Arduino>/libraries/TFT_eSPI/User_Setup.h
 *    and make sure these are set:
 *
 *       #define ILI9341_DRIVER
 *       #define TFT_CS    5
 *       #define TFT_DC    2
 *       #define TFT_RST   4
 *       #define TFT_MOSI  23
 *       #define TFT_SCLK  18
 *       #define SPI_FREQUENCY  40000000
 *
 *    (Match the pins in config.h if you change wiring.)
 *
 *  Workflow:
 *    1. Boot → connect WiFi → sync NTP time.
 *    2. Every 15 s, generate a new token:
 *       • Online mode:  GET <BACKEND_URL>/generate-token?deviceId=ESP32-01
 *       • Offline mode: self-generate  t_<base36_epoch>_<random6>
 *    3. Build URL:  FRONTEND_URL "/scan/" + token
 *    4. Render QR code centred on the TFT with countdown bar.
 *    5. Repeat.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <TFT_eSPI.h>
#include <qrcode.h>

#include "config.h"

// ─── Globals ─────────────────────────────────────────────────
TFT_eSPI tft = TFT_eSPI();

static char currentToken[80]   = {0};
static char currentUrl[200]    = {0};
static unsigned long tokenBornMs = 0;
static bool wifiConnected      = false;
static bool ntpSynced          = false;

// QR code buffer (version 6 = 41×41 modules, fits nicely at 5 px/module = 205 px)
static QRCode qrcode;
static uint8_t qrcodeData[qrcode_getBufferSize(6)];

// ─── Colour palette (dark theme matching Pulse.QR) ───────────
#define COL_BG          tft.color565(12, 17, 24)     // #0c1118
#define COL_CARD_BG     tft.color565(18, 24, 34)     // #121822
#define COL_QR_FG       tft.color565(255, 255, 255)  // white modules
#define COL_QR_BG       tft.color565(12, 17, 24)     // dark modules bg
#define COL_CYAN        tft.color565(0, 245, 212)     // neon cyan
#define COL_CYAN_DIM    tft.color565(0, 80, 70)
#define COL_TEXT         tft.color565(220, 225, 235)
#define COL_TEXT_DIM     tft.color565(100, 110, 130)
#define COL_BAR_BG       tft.color565(30, 35, 45)
#define COL_GREEN        tft.color565(34, 197, 94)
#define COL_RED          tft.color565(239, 68, 68)

// ─── Forward declarations ────────────────────────────────────
void connectWiFi();
void syncNTP();
void drawBootScreen();
void drawWiFiStatus(const char* msg, uint16_t col);
bool fetchTokenFromBackend();
void generateOfflineToken();
void buildUrl();
void drawQrScreen();
void drawQrCode(int x, int y, int pixSize);
void drawCountdownBar(int secondsLeft);
void drawHeader();
void drawTokenText();
char randomAlphaNum();
String toBase36(unsigned long long val);

// =============================================================
//  SETUP
// =============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n[Pulse.QR] Booting ESP32 QR Display...");

  // Backlight
  #if TFT_BL >= 0
    pinMode(TFT_BL, OUTPUT);
    analogWrite(TFT_BL, 200);  // ~80% brightness
  #endif

  // TFT init
  tft.init();
  tft.setRotation(0);  // portrait 240×320
  tft.fillScreen(COL_BG);

  drawBootScreen();
  delay(800);

  // WiFi
  connectWiFi();

  // NTP
  if (wifiConnected) {
    syncNTP();
  }

  // First token
  generateNewToken();
  buildUrl();
  drawQrScreen();

  tokenBornMs = millis();
}

// =============================================================
//  LOOP
// =============================================================
void loop() {
  unsigned long elapsed = millis() - tokenBornMs;

  // ── Rotate token every TOKEN_TTL_MS ──
  if (elapsed >= TOKEN_TTL_MS) {
    generateNewToken();
    buildUrl();
    drawQrScreen();
    tokenBornMs = millis();
  }

  // ── Update countdown bar every ~250 ms ──
  static unsigned long lastBarMs = 0;
  if (millis() - lastBarMs > 250) {
    int secondsLeft = max(0L, (long)(TOKEN_TTL_SEC - (millis() - tokenBornMs) / 1000));
    drawCountdownBar(secondsLeft);
    lastBarMs = millis();
  }

  // ── Reconnect WiFi if dropped ──
  if (WiFi.status() != WL_CONNECTED && wifiConnected) {
    wifiConnected = false;
    drawWiFiIndicator(false);
  }
  if (WiFi.status() == WL_CONNECTED && !wifiConnected) {
    wifiConnected = true;
    drawWiFiIndicator(true);
  }

  delay(50);
}

// =============================================================
//  TOKEN GENERATION
// =============================================================
void generateNewToken() {
  bool gotToken = false;

  // Try backend first
  if (wifiConnected && strlen(BACKEND_URL) > 0) {
    gotToken = fetchTokenFromBackend();
  }

  // Fallback: self-generate (matches frontend format)
  if (!gotToken) {
    generateOfflineToken();
  }

  Serial.printf("[Token] %s\n", currentToken);
}

bool fetchTokenFromBackend() {
  HTTPClient http;
  String url = String(BACKEND_URL) + "/generate-token?deviceId=" + DEVICE_ID;

  http.begin(url);
  http.setTimeout(5000);
  int code = http.GET();

  if (code == 200 || code == 201) {
    String payload = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err && doc["success"].as<bool>()) {
      const char* tok = doc["data"]["token"];
      if (tok && strlen(tok) > 0) {
        strncpy(currentToken, tok, sizeof(currentToken) - 1);
        currentToken[sizeof(currentToken) - 1] = '\0';
        http.end();
        Serial.println("[API] Token fetched from backend");
        return true;
      }
    }
  }

  Serial.printf("[API] Failed (HTTP %d), falling back to offline\n", code);
  http.end();
  return false;
}

void generateOfflineToken() {
  // Format: t_<base36_expiryMs>_<random6>
  // This matches the frontend's generateToken() in store.ts
  unsigned long long expiryMs;

  if (ntpSynced) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    expiryMs = (unsigned long long)tv.tv_sec * 1000ULL +
               (unsigned long long)(tv.tv_usec / 1000) +
               TOKEN_TTL_MS;
  } else {
    // Fallback: use millis-based pseudo-epoch
    expiryMs = (unsigned long long)millis() + TOKEN_TTL_MS + 1700000000000ULL;
  }

  String b36 = toBase36(expiryMs);

  // Random 6-char alphanumeric suffix
  char rand6[7];
  for (int i = 0; i < 6; i++) {
    rand6[i] = randomAlphaNum();
  }
  rand6[6] = '\0';

  snprintf(currentToken, sizeof(currentToken), "t_%s_%s", b36.c_str(), rand6);
}

void buildUrl() {
  snprintf(currentUrl, sizeof(currentUrl), "%s/scan/%s", FRONTEND_URL, currentToken);
  Serial.printf("[QR] URL: %s\n", currentUrl);
}

// =============================================================
//  DISPLAY — Full QR Screen
// =============================================================
void drawQrScreen() {
  tft.fillScreen(COL_BG);

  // ── Header bar ──
  drawHeader();

  // ── QR Code (centred) ──
  // Generate QR code
  qrcode_initText(&qrcode, qrcodeData, 6, ECC_MEDIUM, currentUrl);

  int qrSizePx = qrcode.size * QR_PIXEL_SIZE;
  int qrX = (SCREEN_W - qrSizePx) / 2;
  int qrY = 70;  // below header

  // White background card for QR
  int pad = 10;
  tft.fillRoundRect(qrX - pad, qrY - pad,
                     qrSizePx + pad * 2, qrSizePx + pad * 2,
                     8, COL_QR_FG);

  // Draw QR modules
  drawQrCode(qrX, qrY, QR_PIXEL_SIZE);

  // ── Token text below QR ──
  drawTokenText();

  // ── Countdown bar ──
  drawCountdownBar(TOKEN_TTL_SEC);

  // ── WiFi indicator ──
  drawWiFiIndicator(wifiConnected);
}

void drawHeader() {
  // "Pulse.QR" brand
  tft.setTextColor(COL_CYAN, COL_BG);
  tft.setTextSize(1);
  tft.setTextDatum(TL_DATUM);
  tft.drawString("PULSE.QR", 12, 8);

  // "ESP32 · LIVE" label
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.drawString("ESP32  LIVE", 12, 22);

  // Device ID
  tft.setTextColor(COL_CYAN_DIM, COL_BG);
  tft.setTextDatum(TR_DATUM);
  tft.drawString(DEVICE_ID, SCREEN_W - 12, 8);

  // Divider line
  tft.drawFastHLine(12, 40, SCREEN_W - 24, COL_CYAN_DIM);

  // "SCAN TO CHECK IN" label
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.setTextSize(1);
  tft.setTextDatum(TC_DATUM);
  tft.drawString("SCAN TO CHECK IN", SCREEN_W / 2, 48);
}

void drawQrCode(int x, int y, int pixSize) {
  for (uint8_t my = 0; my < qrcode.size; my++) {
    for (uint8_t mx = 0; mx < qrcode.size; mx++) {
      uint16_t col = qrcode_getModule(&qrcode, mx, my) ? COL_BG : COL_QR_FG;
      if (pixSize == 1) {
        tft.drawPixel(x + mx, y + my, col);
      } else {
        tft.fillRect(x + mx * pixSize, y + my * pixSize,
                     pixSize, pixSize, col);
      }
    }
  }
}

void drawTokenText() {
  // Show truncated token below the QR
  int yPos = 296;
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.setTextSize(1);
  tft.setTextDatum(TC_DATUM);

  // Truncate if too long
  char shortToken[24];
  if (strlen(currentToken) > 20) {
    strncpy(shortToken, currentToken, 17);
    shortToken[17] = '.';
    shortToken[18] = '.';
    shortToken[19] = '.';
    shortToken[20] = '\0';
  } else {
    strcpy(shortToken, currentToken);
  }
  tft.drawString(shortToken, SCREEN_W / 2, yPos);
}

// =============================================================
//  COUNTDOWN BAR
// =============================================================
void drawCountdownBar(int secondsLeft) {
  int barY = 280;
  int barX = 20;
  int barW = SCREEN_W - 40;
  int barH = 6;

  // Background
  tft.fillRoundRect(barX, barY, barW, barH, 3, COL_BAR_BG);

  // Filled portion
  float pct = (float)secondsLeft / TOKEN_TTL_SEC;
  int fillW = (int)(barW * pct);

  // Colour: green→cyan→red
  uint16_t barCol;
  if (pct > 0.5) {
    barCol = COL_CYAN;
  } else if (pct > 0.2) {
    barCol = tft.color565(255, 200, 0);  // amber
  } else {
    barCol = COL_RED;
  }

  if (fillW > 0) {
    tft.fillRoundRect(barX, barY, fillW, barH, 3, barCol);
  }

  // Timer text: "12s"
  tft.fillRect(SCREEN_W / 2 - 20, barY + 10, 40, 14, COL_BG); // clear old text
  tft.setTextColor(barCol, COL_BG);
  tft.setTextSize(1);
  tft.setTextDatum(TC_DATUM);
  char buf[8];
  snprintf(buf, sizeof(buf), "%ds", secondsLeft);
  tft.drawString(buf, SCREEN_W / 2, barY + 10);
}

// =============================================================
//  WiFi INDICATOR (top-right dot)
// =============================================================
void drawWiFiIndicator(bool connected) {
  int x = SCREEN_W - 20;
  int y = 24;
  tft.fillCircle(x, y, 4, connected ? COL_GREEN : COL_RED);
}

// =============================================================
//  BOOT SCREEN
// =============================================================
void drawBootScreen() {
  tft.fillScreen(COL_BG);

  // Brand
  tft.setTextColor(COL_CYAN);
  tft.setTextSize(3);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("PULSE", SCREEN_W / 2, SCREEN_H / 2 - 30);
  tft.drawString(".QR", SCREEN_W / 2, SCREEN_H / 2 + 10);

  // Tagline
  tft.setTextColor(COL_TEXT_DIM);
  tft.setTextSize(1);
  tft.drawString("Smart Attendance", SCREEN_W / 2, SCREEN_H / 2 + 45);

  // Decorative line
  tft.drawFastHLine(50, SCREEN_H / 2 + 60, SCREEN_W - 100, COL_CYAN_DIM);
}

// =============================================================
//  WiFi CONNECT
// =============================================================
void connectWiFi() {
  drawWiFiStatus("Connecting to WiFi...", COL_TEXT);
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    Serial.print(".");
    delay(400);
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    drawWiFiStatus("WiFi connected!", COL_GREEN);
  } else {
    wifiConnected = false;
    Serial.println("\n[WiFi] FAILED — running offline");
    drawWiFiStatus("WiFi failed. Offline mode.", COL_RED);
  }
  delay(600);
}

void drawWiFiStatus(const char* msg, uint16_t col) {
  tft.fillRect(0, SCREEN_H - 30, SCREEN_W, 30, COL_BG);
  tft.setTextColor(col, COL_BG);
  tft.setTextSize(1);
  tft.setTextDatum(BC_DATUM);
  tft.drawString(msg, SCREEN_W / 2, SCREEN_H - 8);
}

// =============================================================
//  NTP SYNC
// =============================================================
void syncNTP() {
  Serial.println("[NTP] Syncing time...");
  drawWiFiStatus("Syncing clock (NTP)...", COL_TEXT);

  configTime(GMT_OFFSET_SEC, DST_OFFSET_SEC, NTP_SERVER);

  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 8000)) {
    ntpSynced = true;
    Serial.printf("[NTP] Time: %04d-%02d-%02d %02d:%02d:%02d\n",
                  timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                  timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    drawWiFiStatus("Clock synced!", COL_GREEN);
  } else {
    ntpSynced = false;
    Serial.println("[NTP] Failed to sync");
    drawWiFiStatus("NTP failed. Using local clock.", COL_RED);
  }
  delay(500);
}

// =============================================================
//  UTILITIES
// =============================================================
char randomAlphaNum() {
  const char charset[] = "0123456789abcdefghijklmnopqrstuvwxyz";
  return charset[random(0, sizeof(charset) - 1)];
}

String toBase36(unsigned long long val) {
  if (val == 0) return "0";
  const char digits[] = "0123456789abcdefghijklmnopqrstuvwxyz";
  char buf[20];
  int i = sizeof(buf) - 1;
  buf[i] = '\0';
  while (val > 0 && i > 0) {
    buf[--i] = digits[val % 36];
    val /= 36;
  }
  return String(&buf[i]);
}
