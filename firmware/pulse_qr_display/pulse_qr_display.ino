/*
 * ============================================================
 *  Pulse.QR — ESP32 Dynamic QR Attendance Display
 * ============================================================
 *
 *  Hardware:  ESP32 + 2.4″ ILI9341 TFT (240×320, SPI)
 *
 *  Libraries (install via Arduino Library Manager):
 *    1. TFT_eSPI   (Bodmer)       — TFT driver
 *    2. qrcode     (Richard Moore) — QR generation
 *    3. ArduinoJson (Benoît Blanchon, v7) — JSON parsing
 *
 *  CRITICAL: Edit TFT_eSPI/User_Setup.h before compiling:
 *    #define ILI9341_DRIVER
 *    #define TFT_CS    5
 *    #define TFT_DC    2
 *    #define TFT_RST   4
 *    #define TFT_MOSI  23
 *    #define TFT_SCLK  18
 *    #define SPI_FREQUENCY  40000000
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <sys/time.h>
#include <TFT_eSPI.h>
#include <qrcode.h>

#include "config.h"

// ─── Display ─────────────────────────────────────────────────
TFT_eSPI tft = TFT_eSPI();

// ─── State ───────────────────────────────────────────────────
char currentToken[80];
char currentUrl[220];
unsigned long tokenBornMs   = 0;
bool wifiConnected          = false;
bool ntpSynced              = false;
unsigned long lastBarUpdate = 0;

// ─── QR buffer ───────────────────────────────────────────────
// QR Version 6 = 41×41 modules. At 5 px/module = 205 px (fits 240 w)
#define QR_VERSION 6
QRCode qrcode;
uint8_t qrcodeBytes[qrcode_getBufferSize(QR_VERSION)];

// ─── Colour palette (Pulse.QR dark theme) ────────────────────
#define COL_BG        tft.color565(12, 17, 24)
#define COL_QR_WHITE  tft.color565(255, 255, 255)
#define COL_CYAN      tft.color565(0, 245, 212)
#define COL_CYAN_DIM  tft.color565(0, 80, 70)
#define COL_TEXT      tft.color565(220, 225, 235)
#define COL_TEXT_DIM  tft.color565(100, 110, 130)
#define COL_BAR_BG    tft.color565(30, 35, 45)
#define COL_GREEN     tft.color565(34, 197, 94)
#define COL_AMBER     tft.color565(255, 200, 0)
#define COL_RED       tft.color565(239, 68, 68)

// ─── Helpers ─────────────────────────────────────────────────
char randomAlphaNum();
String toBase36(unsigned long long v);
void generateNewToken();
bool fetchTokenFromBackend();
void generateOfflineToken();
void buildUrl();

void initBacklight();
void drawBootScreen();
void drawWiFiStatusMsg(const char* msg, uint16_t col);
void connectWiFi();
void syncNTP();

void drawQrScreen();
void drawHeader();
void drawQrCode(int x, int y, int pxSize);
void drawTokenText();
void drawCountdownBar(int secsLeft);
void drawWiFiDot(bool on);

// =============================================================
//                          SETUP
// =============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n[Pulse.QR] Booting...");

  // Backlight
  initBacklight();

  // TFT
  tft.init();
  tft.setRotation(0);          // portrait 240×320
  tft.fillScreen(COL_BG);

  // Seed random
  randomSeed(analogRead(0) ^ micros());

  // Splash
  drawBootScreen();
  delay(1000);

  // WiFi
  connectWiFi();

  // NTP
  if (wifiConnected) syncNTP();

  // First token
  generateNewToken();
  buildUrl();
  drawQrScreen();
  tokenBornMs = millis();
}

// =============================================================
//                          LOOP
// =============================================================
void loop() {
  unsigned long now = millis();
  unsigned long elapsed = now - tokenBornMs;

  // ── Rotate token ──
  if (elapsed >= TOKEN_TTL_MS) {
    generateNewToken();
    buildUrl();
    drawQrScreen();
    tokenBornMs = millis();
  }

  // ── Countdown bar (~4 Hz) ──
  if (now - lastBarUpdate > 250) {
    long secsLeft = (long)TOKEN_TTL_SEC - (long)(elapsed / 1000);
    if (secsLeft < 0) secsLeft = 0;
    drawCountdownBar((int)secsLeft);
    lastBarUpdate = now;
  }

  // ── WiFi watchdog ──
  bool nowConn = (WiFi.status() == WL_CONNECTED);
  if (nowConn != wifiConnected) {
    wifiConnected = nowConn;
    drawWiFiDot(wifiConnected);
  }

  delay(50);
}

// =============================================================
//  TOKEN GENERATION
// =============================================================
void generateNewToken() {
  bool ok = false;

  if (wifiConnected && strlen(BACKEND_URL) > 0) {
    ok = fetchTokenFromBackend();
  }

  if (!ok) {
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
    String body = http.getString();
    JsonDocument doc;
    if (!deserializeJson(doc, body) && doc["success"].as<bool>()) {
      const char* tok = doc["data"]["token"];
      if (tok && strlen(tok) > 0) {
        strncpy(currentToken, tok, sizeof(currentToken) - 1);
        currentToken[sizeof(currentToken) - 1] = '\0';
        http.end();
        Serial.println("[API] Got token from backend");
        return true;
      }
    }
  }
  Serial.printf("[API] Failed HTTP %d — falling back offline\n", code);
  http.end();
  return false;
}

void generateOfflineToken() {
  // Matches frontend: t_<base36_expiryMs>_<random6>
  unsigned long long expiryMs;

  if (ntpSynced) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    expiryMs = (unsigned long long)tv.tv_sec * 1000ULL
             + (unsigned long long)(tv.tv_usec / 1000)
             + TOKEN_TTL_MS;
  } else {
    expiryMs = (unsigned long long)millis() + TOKEN_TTL_MS + 1700000000000ULL;
  }

  String b36 = toBase36(expiryMs);
  char r[7];
  for (int i = 0; i < 6; i++) r[i] = randomAlphaNum();
  r[6] = '\0';

  snprintf(currentToken, sizeof(currentToken), "t_%s_%s", b36.c_str(), r);
}

void buildUrl() {
  snprintf(currentUrl, sizeof(currentUrl), "%s/scan/%s", FRONTEND_URL, currentToken);
  Serial.printf("[QR] %s\n", currentUrl);
}

// =============================================================
//  DISPLAY — Full redraw
// =============================================================
void drawQrScreen() {
  tft.fillScreen(COL_BG);
  drawHeader();

  // Generate QR
  qrcode_initText(&qrcode, qrcodeBytes, QR_VERSION, ECC_MEDIUM, currentUrl);

  int qrPx   = qrcode.size * QR_PIXEL_SIZE;
  int qrX    = (SCREEN_W - qrPx) / 2;
  int qrY    = 70;
  int pad    = 10;

  // White card behind QR
  tft.fillRoundRect(qrX - pad, qrY - pad,
                    qrPx + pad * 2, qrPx + pad * 2,
                    8, COL_QR_WHITE);

  drawQrCode(qrX, qrY, QR_PIXEL_SIZE);
  drawTokenText();
  drawCountdownBar(TOKEN_TTL_SEC);
  drawWiFiDot(wifiConnected);
}

void drawHeader() {
  tft.setTextDatum(TL_DATUM);
  tft.setTextSize(1);
  tft.setTextColor(COL_CYAN, COL_BG);
  tft.drawString("PULSE.QR", 12, 8);

  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.drawString("ESP32  LIVE", 12, 22);

  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_CYAN_DIM, COL_BG);
  tft.drawString(DEVICE_ID, SCREEN_W - 12, 8);

  tft.drawFastHLine(12, 40, SCREEN_W - 24, COL_CYAN_DIM);

  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString("SCAN TO CHECK IN", SCREEN_W / 2, 48);
}

void drawQrCode(int x, int y, int pxSize) {
  for (uint8_t row = 0; row < qrcode.size; row++) {
    for (uint8_t col = 0; col < qrcode.size; col++) {
      uint16_t c = qrcode_getModule(&qrcode, col, row) ? COL_BG : COL_QR_WHITE;
      tft.fillRect(x + col * pxSize, y + row * pxSize, pxSize, pxSize, c);
    }
  }
}

void drawTokenText() {
  char buf[24];
  int len = strlen(currentToken);
  if (len > 20) {
    strncpy(buf, currentToken, 17);
    buf[17] = '.'; buf[18] = '.'; buf[19] = '.'; buf[20] = '\0';
  } else {
    strcpy(buf, currentToken);
  }
  tft.setTextDatum(TC_DATUM);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.drawString(buf, SCREEN_W / 2, 296);
}

// =============================================================
//  COUNTDOWN BAR  (called ~4× per second, partial redraw)
// =============================================================
void drawCountdownBar(int secsLeft) {
  const int bx = 20, by = 280, bw = SCREEN_W - 40, bh = 6;

  // Background track
  tft.fillRoundRect(bx, by, bw, bh, 3, COL_BAR_BG);

  // Fill
  float pct  = (float)secsLeft / TOKEN_TTL_SEC;
  int   fill = (int)(bw * pct);
  uint16_t barCol = (pct > 0.5f) ? COL_CYAN : (pct > 0.2f) ? COL_AMBER : COL_RED;
  if (fill > 0) tft.fillRoundRect(bx, by, fill, bh, 3, barCol);

  // Timer label
  tft.fillRect(SCREEN_W / 2 - 20, by + 10, 40, 14, COL_BG);
  tft.setTextDatum(TC_DATUM);
  tft.setTextSize(1);
  tft.setTextColor(barCol, COL_BG);
  char lb[8];
  snprintf(lb, sizeof(lb), "%ds", secsLeft);
  tft.drawString(lb, SCREEN_W / 2, by + 10);
}

// =============================================================
//  WiFi DOT (top-right)
// =============================================================
void drawWiFiDot(bool on) {
  tft.fillCircle(SCREEN_W - 20, 24, 4, on ? COL_GREEN : COL_RED);
}

// =============================================================
//  BOOT / WiFi / NTP
// =============================================================
void initBacklight() {
#if TFT_BL_PIN >= 0
  pinMode(TFT_BL_PIN, OUTPUT);
  digitalWrite(TFT_BL_PIN, HIGH);   // full brightness
#endif
}

void drawBootScreen() {
  tft.fillScreen(COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.setTextSize(3);
  tft.setTextColor(COL_CYAN);
  tft.drawString("PULSE", SCREEN_W / 2, SCREEN_H / 2 - 30);
  tft.drawString(".QR", SCREEN_W / 2, SCREEN_H / 2 + 10);

  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_DIM);
  tft.drawString("Smart Attendance", SCREEN_W / 2, SCREEN_H / 2 + 45);
  tft.drawFastHLine(50, SCREEN_H / 2 + 60, SCREEN_W - 100, COL_CYAN_DIM);
}

void drawWiFiStatusMsg(const char* msg, uint16_t col) {
  tft.fillRect(0, SCREEN_H - 30, SCREEN_W, 30, COL_BG);
  tft.setTextDatum(BC_DATUM);
  tft.setTextSize(1);
  tft.setTextColor(col, COL_BG);
  tft.drawString(msg, SCREEN_W / 2, SCREEN_H - 8);
}

void connectWiFi() {
  drawWiFiStatusMsg("Connecting to WiFi...", COL_TEXT);
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < WIFI_TIMEOUT_MS) {
    Serial.print(".");
    delay(400);
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.printf("\n[WiFi] OK  IP %s\n", WiFi.localIP().toString().c_str());
    drawWiFiStatusMsg("WiFi connected!", COL_GREEN);
  } else {
    wifiConnected = false;
    Serial.println("\n[WiFi] FAIL — offline mode");
    drawWiFiStatusMsg("WiFi failed — offline mode", COL_RED);
  }
  delay(600);
}

void syncNTP() {
  drawWiFiStatusMsg("Syncing clock...", COL_TEXT);
  Serial.println("[NTP] Syncing...");

  configTime(GMT_OFFSET_SEC, DST_OFFSET_SEC, NTP_SERVER);
  struct tm ti;
  if (getLocalTime(&ti, 8000)) {
    ntpSynced = true;
    Serial.printf("[NTP] %04d-%02d-%02d %02d:%02d:%02d\n",
                  ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday,
                  ti.tm_hour, ti.tm_min, ti.tm_sec);
    drawWiFiStatusMsg("Clock synced!", COL_GREEN);
  } else {
    ntpSynced = false;
    Serial.println("[NTP] Failed");
    drawWiFiStatusMsg("NTP failed — local clock", COL_RED);
  }
  delay(500);
}

// =============================================================
//  UTILITIES
// =============================================================
char randomAlphaNum() {
  static const char cs[] = "0123456789abcdefghijklmnopqrstuvwxyz";
  return cs[random(0, sizeof(cs) - 1)];
}

String toBase36(unsigned long long v) {
  if (v == 0) return String("0");
  static const char d[] = "0123456789abcdefghijklmnopqrstuvwxyz";
  char buf[20];
  int i = 18;
  buf[19] = '\0';
  while (v > 0 && i >= 0) {
    buf[i--] = d[v % 36];
    v /= 36;
  }
  return String(&buf[i + 1]);
}
