package com.palexy.scheduler.shift;

public record ShiftResponse(Long id, int startHour, int endHour) {

    static ShiftResponse of(Shift shift) {
        return new ShiftResponse(shift.getId(), shift.getStartHour(), shift.getEndHour());
    }
}
