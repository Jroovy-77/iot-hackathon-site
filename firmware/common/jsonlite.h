// JSON แบบเล็กที่สุดที่ตัวรับต้องใช้: อ่านช่องจากคำสั่งของเว็บ (วัตถุชั้นเดียว) และเขียนสตริงแบบ escape
// ไม่ใช่ตัวแปลง JSON เต็มรูปแบบ — คำสั่งจากแดชบอร์ดเป็น {"cmd":"accept","rid":5,"id":1001} เท่านั้น
#pragma once
#include <stddef.h>
#include <string>

namespace jsonlite {

// หา "key": แล้วคืนตำแหน่งค่า (ข้ามช่องว่าง) · 0 = ไม่มี
const char* findValue(const char* s, const char* key);
// สตริง: true ถ้าเจอและเป็นสตริง
bool getStr(const char* s, const char* key, std::string& out);
// จำนวนเต็ม: true ถ้าเจอและเป็นตัวเลข (null / ไม่มี = false)
bool getInt(const char* s, const char* key, long& out);
// ค่าเป็น null ไหม
bool isNull(const char* s, const char* key);

void appendEscaped(std::string& out, const char* s);   // "..." พร้อม escape
void appendFloat(std::string& out, float v, int decimals);

}  // namespace jsonlite
