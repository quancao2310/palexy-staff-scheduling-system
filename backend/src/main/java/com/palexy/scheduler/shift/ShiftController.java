package com.palexy.scheduler.shift;

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
@RequestMapping("/api/schedules/{scheduleId}/shifts")
public class ShiftController {

    private final ShiftService service;

    public ShiftController(ShiftService service) {
        this.service = service;
    }

    @GetMapping
    List<ShiftResponse> list(@PathVariable Long scheduleId) {
        return service.list(scheduleId);
    }

    @PostMapping
    ResponseEntity<ShiftResponse> create(@PathVariable Long scheduleId, @Valid @RequestBody ShiftRequest request) {
        ShiftResponse created = service.create(scheduleId, request);
        return ResponseEntity.created(
                ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(created.id()).toUri())
                .body(created);
    }

    @PutMapping("/{shiftId}")
    ShiftResponse update(@PathVariable Long scheduleId, @PathVariable Long shiftId,
                         @Valid @RequestBody ShiftRequest request) {
        return service.update(scheduleId, shiftId, request);
    }

    @DeleteMapping("/{shiftId}")
    ResponseEntity<Void> delete(@PathVariable Long scheduleId, @PathVariable Long shiftId) {
        service.delete(scheduleId, shiftId);
        return ResponseEntity.noContent().build();
    }
}
