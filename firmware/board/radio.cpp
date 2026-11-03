#include "radio.h"

#include <RadioLib.h>
#include <SPI.h>

#include "pins.h"
#include "radio_config.h"

namespace {
SX1276 lora = new Module(pins::RADIO_NSS, pins::RADIO_DIO0, pins::RADIO_RESET, RADIOLIB_NC);
volatile bool dio0Flag = false;
void IRAM_ATTR onDio0() { dio0Flag = true; }
}  // namespace

namespace radio {

int16_t begin() {
  SPI.begin(pins::RADIO_SCK, pins::RADIO_MISO, pins::RADIO_MOSI, pins::RADIO_NSS);
  int16_t st = lora.begin(radio_cfg::FREQ_MHZ, radio_cfg::BW_KHZ, radio_cfg::SF, radio_cfg::CR_DENOM,
                          radio_cfg::SYNC_WORD, radio_cfg::TX_DBM, radio_cfg::PREAMBLE);
  if (st != RADIOLIB_ERR_NONE) return st;
  st = lora.setCRC(true);
  if (st != RADIOLIB_ERR_NONE) return st;
  lora.setPacketReceivedAction(onDio0);
  dio0Flag = false;
  return lora.startReceive();
}

int16_t send(const proto::Msg& m, float* airMs) {
  uint8_t buf[proto::MAX_LEN];
  const size_t len = proto::encode(m, buf, sizeof buf);
  if (!len) return RADIOLIB_ERR_PACKET_TOO_LONG;
  const int16_t st = lora.transmit(buf, len);
  if (airMs) *airMs = proto::airtimeMs(len, radio_cfg::SF, radio_cfg::BW_KHZ, radio_cfg::CR_DENOM, radio_cfg::PREAMBLE);
  dio0Flag = false;   // DIO0 ขึ้นตอนส่งเสร็จด้วย ไม่ใช่ข้อความเข้า
  lora.startReceive();
  return st;
}

RxResult receive(proto::Msg& out, float& rssi, float& snr, int16_t& code) {
  if (!dio0Flag) return RX_NONE;
  dio0Flag = false;
  uint8_t buf[64];
  size_t len = lora.getPacketLength();
  if (len > sizeof buf) len = sizeof buf;
  rssi = lora.getRSSI();
  snr = lora.getSNR();
  code = lora.readData(buf, len);
  lora.startReceive();
  if (code != RADIOLIB_ERR_NONE) return RX_BAD;
  const proto::Result r = proto::decode(buf, len, radio_cfg::NET_ID, out);
  if (r != proto::OK) {
    code = -1000 - r;   // -1001 ยาวผิด · -1002 ไม่รู้จักชนิด · -1003 คนละพื้นที่
    return RX_BAD;
  }
  return RX_OK;
}

}  // namespace radio
