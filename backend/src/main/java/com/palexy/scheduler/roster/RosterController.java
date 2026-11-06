package com.palexy.scheduler.roster;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

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

    @PostMapping
    ResponseEntity<AssignmentResponse> add(@PathVariable Long scheduleId,
                                           @Valid @RequestBody AssignmentRequest request) {
        AssignmentResponse created = service.add(scheduleId, request);
        return ResponseEntity.created(
                ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(created.id()).toUri())
                .body(created);
    }

    @DeleteMapping("/{assignmentId}")
    ResponseEntity<Void> remove(@PathVariable Long scheduleId, @PathVariable Long assignmentId) {
        service.remove(scheduleId, assignmentId);
        return ResponseEntity.noContent().build();
    }
}
