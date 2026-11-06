package com.palexy.scheduler.staff;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api/schedules/{scheduleId}/staff")
public class StaffController {

    private final StaffService service;

    public StaffController(StaffService service) {
        this.service = service;
    }

    @GetMapping
    List<StaffResponse> list(@PathVariable Long scheduleId) {
        return service.list(scheduleId);
    }

    @PostMapping
    ResponseEntity<StaffResponse> create(@PathVariable Long scheduleId, @Valid @RequestBody StaffRequest request) {
        StaffResponse created = service.create(scheduleId, request);
        return ResponseEntity.created(
                ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(created.id()).toUri())
                .body(created);
    }

    @PutMapping("/{staffId}")
    StaffResponse update(@PathVariable Long scheduleId, @PathVariable Long staffId,
                         @Valid @RequestBody StaffRequest request) {
        return service.update(scheduleId, staffId, request);
    }

    @DeleteMapping("/{staffId}")
    ResponseEntity<Void> delete(@PathVariable Long scheduleId, @PathVariable Long staffId) {
        service.delete(scheduleId, staffId);
        return ResponseEntity.noContent().build();
    }
}
