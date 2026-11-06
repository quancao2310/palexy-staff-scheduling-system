package com.palexy.scheduler.staff;

public record StaffResponse(Long id, String name, int maxWeeklyHours) {

    static StaffResponse of(Staff staff) {
        return new StaffResponse(staff.getId(), staff.getName(), staff.getMaxWeeklyHours());
    }
}
