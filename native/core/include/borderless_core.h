#ifndef BORDERLESS_CORE_H
#define BORDERLESS_CORE_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct { double x; double y; uint32_t valid; } BLPointResult;
uint32_t bl_core_abi_version(void);
BLPointResult bl_display_uv(double origin_x, double origin_y, double width, double height,
                           double point_x, double point_y, uint32_t clockwise_rotation);
/* 0 stopped, 1 starting, 2 receiving, 3 no recent complete frame, 4 invalid. */
uint32_t bl_capture_status(uint32_t active, uint64_t started_ms, uint64_t last_frame_ms,
                           uint64_t complete_frames, uint64_t now_ms, uint64_t timeout_ms);
#ifdef __cplusplus
}
#endif
#endif
