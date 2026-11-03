#include "jsonlite.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace jsonlite {

namespace {
const char* skipWs(const char* p) {
  while (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n') p++;
  return p;
}
}  // namespace

const char* findValue(const char* s, const char* key) {
  if (!s || !key) return 0;
  const size_t kl = strlen(key);
  for (const char* p = strchr(s, '"'); p; p = strchr(p + 1, '"')) {
    if (strncmp(p + 1, key, kl) == 0 && p[1 + kl] == '"') {
      const char* q = skipWs(p + 2 + kl);
      if (*q == ':') return skipWs(q + 1);
    }
  }
  return 0;
}

bool getStr(const char* s, const char* key, std::string& out) {
  const char* v = findValue(s, key);
  if (!v || *v != '"') return false;
  out.clear();
  for (const char* p = v + 1; *p; p++) {
    if (*p == '"') return true;
    if (*p == '\\' && p[1]) {
      p++;
      switch (*p) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        default: out += *p; break;   // \" \\ \/ (ไม่รองรับ \u ซึ่งคำสั่งไม่ได้ใช้)
      }
      continue;
    }
    out += *p;
  }
  return false;   // ไม่มีเครื่องหมายปิด
}

bool getInt(const char* s, const char* key, long& out) {
  const char* v = findValue(s, key);
  if (!v || !(*v == '-' || (*v >= '0' && *v <= '9'))) return false;
  char* end = 0;
  out = strtol(v, &end, 10);
  return end != v;
}

bool isNull(const char* s, const char* key) {
  const char* v = findValue(s, key);
  return v && strncmp(v, "null", 4) == 0;
}

void appendEscaped(std::string& out, const char* s) {
  out += '"';
  for (const unsigned char* p = (const unsigned char*)s; *p; p++) {
    if (*p == '"' || *p == '\\') {
      out += '\\';
      out += (char)*p;
    } else if (*p < 0x20) {
      char b[8];
      snprintf(b, sizeof b, "\\u%04x", *p);
      out += b;
    } else {
      out += (char)*p;   // UTF-8 ผ่านตรง ๆ
    }
  }
  out += '"';
}

void appendFloat(std::string& out, float v, int decimals) {
  char b[24];
  snprintf(b, sizeof b, "%.*f", decimals, (double)v);
  out += b;
}

}  // namespace jsonlite
