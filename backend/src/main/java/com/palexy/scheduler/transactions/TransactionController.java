package com.palexy.scheduler.transactions;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;

@RestController
@RequestMapping("/api/schedules/{scheduleId}/transactions")
public class TransactionController {

    private final TransactionService service;

    public TransactionController(TransactionService service) {
        this.service = service;
    }

    @GetMapping
    TransactionsResponse get(@PathVariable Long scheduleId) {
        return service.get(scheduleId);
    }

    @PutMapping(consumes = "multipart/form-data")
    TransactionsResponse upload(@PathVariable Long scheduleId, @RequestParam MultipartFile file) {
        try {
            return service.replace(scheduleId, file.getOriginalFilename(), file.getBytes());
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the uploaded file", e);
        }
    }

    @DeleteMapping
    ResponseEntity<Void> clear(@PathVariable Long scheduleId) {
        service.clear(scheduleId);
        return ResponseEntity.noContent().build();
    }
}
