package com.palexy.scheduler.shift;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "shift")
public class Shift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long scheduleId;
    private int startHour;
    private int endHour;

    protected Shift() {
    }

    public Shift(Long scheduleId, int startHour, int endHour) {
        this.scheduleId = scheduleId;
        this.startHour = startHour;
        this.endHour = endHour;
    }

    public void reschedule(int startHour, int endHour) {
        this.startHour = startHour;
        this.endHour = endHour;
    }

    public Long getId() {
        return id;
    }

    public Long getScheduleId() {
        return scheduleId;
    }

    public int getStartHour() {
        return startHour;
    }

    public int getEndHour() {
        return endHour;
    }
}
