#include "heartbeat.h"

void Heartbeat::sent(uint32_t nowS, bool warnActive) {
  const uint32_t base = warnActive ? timing::hbWarnS() : timing::hbNormalS();
  const uint32_t j = timing::hbJitterS();
  nextS_ = nowS + base - j + rnd_(0, 2 * j);   // base ± jitter
}

void Heartbeat::kick(uint32_t nowS, uint32_t maxDelayS) {
  const uint32_t at = nowS + (maxDelayS ? rnd_(0, maxDelayS) : 0);
  if ((int32_t)(at - nextS_) < 0) nextS_ = at;
}
