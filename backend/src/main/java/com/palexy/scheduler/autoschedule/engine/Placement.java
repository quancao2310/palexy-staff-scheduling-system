package com.palexy.scheduler.autoschedule.engine;

/** One person working one shift on one day ({@code day}: 1 = Monday ... 7 = Sunday). */
public record Placement(int day, long shiftId, long staffId) {
}
