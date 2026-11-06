package com.palexy.scheduler.autoschedule.engine;

/** A shift {@code [startHour, endHour)}; {@code endHour = 24} means midnight. */
public record ShiftDef(long id, int startHour, int endHour) {

    public int length() {
        return endHour - startHour;
    }

    public boolean covers(int hour) {
        return hour >= startHour && hour < endHour;
    }

    public boolean overlaps(ShiftDef other) {
        return startHour < other.endHour && other.startHour < endHour;
    }
}
