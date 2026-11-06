package com.palexy.scheduler.autoschedule;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/schedules/{scheduleId}/auto-schedule")
public class AutoScheduleController {

    private final AutoScheduleService service;

    public AutoScheduleController(AutoScheduleService service) {
        this.service = service;
    }

    @PostMapping
    AutoScheduleResponse generate(@PathVariable Long scheduleId) {
        return service.generate(scheduleId);
    }
}
