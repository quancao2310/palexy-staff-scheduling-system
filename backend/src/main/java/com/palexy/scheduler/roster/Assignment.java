package com.palexy.scheduler.roster;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** One person working one shift on one day ({@code dayOfWeek}: 1 = Monday ... 7 = Sunday). */
@Entity
@Table(name = "assignment")
public class Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long scheduleId;
    private int dayOfWeek;
    private Long shiftId;
    private Long staffId;

    protected Assignment() {
    }

    public Assignment(Long scheduleId, int dayOfWeek, Long shiftId, Long staffId) {
        this.scheduleId = scheduleId;
        this.dayOfWeek = dayOfWeek;
        this.shiftId = shiftId;
        this.staffId = staffId;
    }

    public Long getId() {
        return id;
    }

    public Long getScheduleId() {
        return scheduleId;
    }

    public int getDayOfWeek() {
        return dayOfWeek;
    }

    public Long getShiftId() {
        return shiftId;
    }

    public Long getStaffId() {
        return staffId;
    }
}
