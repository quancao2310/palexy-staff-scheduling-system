package com.palexy.scheduler.staff;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "staff")
public class Staff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long scheduleId;
    private String name;
    private int maxWeeklyHours;

    protected Staff() {
    }

    public Staff(Long scheduleId, String name, int maxWeeklyHours) {
        this.scheduleId = scheduleId;
        this.name = name;
        this.maxWeeklyHours = maxWeeklyHours;
    }

    public void update(String name, int maxWeeklyHours) {
        this.name = name;
        this.maxWeeklyHours = maxWeeklyHours;
    }

    public Long getId() {
        return id;
    }

    public Long getScheduleId() {
        return scheduleId;
    }

    public String getName() {
        return name;
    }

    public int getMaxWeeklyHours() {
        return maxWeeklyHours;
    }
}
