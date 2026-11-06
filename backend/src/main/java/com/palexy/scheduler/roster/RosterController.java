package com.palexy.scheduler.roster;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/schedules/{scheduleId}/assignments")
public class RosterController {

    private final RosterService service;

    public RosterController(RosterService service) {
        this.service = service;
    }

    @GetMapping
    List<AssignmentResponse> list(@PathVariable Long scheduleId) {
        return service.list(scheduleId);
    }
}
