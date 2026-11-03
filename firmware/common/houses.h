// บ้านที่ลงทะเบียนกับตัวรับ (อสม. ลงทะเบียนล่วงหน้า: ID + ตำแหน่ง + ติดเตียงไหม)
// รอบ Breadboard มีกล่องบ้านจริง 1 กล่อง · ชื่อและตำแหน่งเป็น **ข้อมูลสมมติ** สำหรับทดสอบ
// x, y = เมตรบนแผนที่ชุมชนจำลองของแดชบอร์ด (ช่วงเดียวกับบ้านในโหมดจำลอง)
#pragma once
#include <stddef.h>
#include <stdint.h>

struct HouseInfo {
  uint16_t id;
  const char* name;   // UTF-8
  int16_t x, y;
  bool bed;           // บ้านติดเตียง (มีสายวัดน้ำ ขอแทนอัตโนมัติได้)
};

static const HouseInfo HOUSES[] = {
    {1001, "บ้านทดลอง 1", 200, 105, true},
};
static const size_t HOUSE_COUNT = sizeof(HOUSES) / sizeof(HOUSES[0]);

#ifndef HOUSE_ID
#define HOUSE_ID 1001   // กล่องบ้านที่กำลังอัปโหลด (ทำกล่องที่ 2 ให้ใส่ -D HOUSE_ID=1002 แล้วเพิ่มแถวด้านบน)
#endif

inline const HouseInfo* findHouse(uint16_t id) {
  for (size_t i = 0; i < HOUSE_COUNT; i++)
    if (HOUSES[i].id == id) return &HOUSES[i];
  return 0;
}
