// วิทยุ SX1276 ผ่าน RadioLib — ใช้ร่วมกันทั้งกล่องบ้าน ตัวรับ และ ping/pong
// ขาจาก common/pins.h · ค่าจาก common/radio_config.h (ไม่มีเลขในไฟล์นี้)
#pragma once
#include <stddef.h>
#include <stdint.h>

#include "protocol.h"

namespace radio {

// เริ่มวิทยุแล้วเข้าโหมดฟัง · คืนรหัสของ RadioLib (0 = ผ่าน) เช่น -2 = หาชิปไม่เจอ (เช็กสาย SPI / NSS / ไฟ 3V3)
int16_t begin();
// ส่ง (รอจนส่งเสร็จ) แล้วกลับไปฟัง · คืนรหัสของ RadioLib · airMs = เวลาออกอากาศโดยประมาณ
int16_t send(const proto::Msg& m, float* airMs = 0);

enum RxResult { RX_NONE = 0, RX_OK, RX_BAD };
// ไม่รอ: มีข้อความเข้าไหม · RX_BAD = CRC ผิด / ถอดรหัสไม่ได้ / คนละพื้นที่ (code บอกเหตุ)
RxResult receive(proto::Msg& out, float& rssi, float& snr, int16_t& code);

}  // namespace radio
