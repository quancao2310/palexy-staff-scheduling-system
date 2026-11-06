package com.palexy.scheduler.autoschedule.engine;

/** One person-sized seat to fill: a shift on a day. A day-shift that needs three people is three slots. */
public record Slot(int day, ShiftDef shift) {
}
