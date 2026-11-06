package com.palexy.scheduler.autoschedule.engine;

public record StaffLoad(long staffId, String name, int hours, int maxHours, double utilisation) {
}
