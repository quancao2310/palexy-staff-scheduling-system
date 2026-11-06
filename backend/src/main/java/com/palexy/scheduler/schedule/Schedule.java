package com.palexy.scheduler.schedule;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "schedule")
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    private String transactionsFileName;
    private Instant transactionsUploadedAt;

    protected Schedule() {
    }

    public Schedule(String name) {
        this.name = name;
    }

    public void rename(String name) {
        this.name = name;
        this.updatedAt = Instant.now();
    }

    public void recordUpload(String fileName) {
        this.transactionsFileName = fileName;
        this.transactionsUploadedAt = Instant.now();
        this.updatedAt = this.transactionsUploadedAt;
    }

    public void clearUpload() {
        this.transactionsFileName = null;
        this.transactionsUploadedAt = null;
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getTransactionsFileName() {
        return transactionsFileName;
    }

    public Instant getTransactionsUploadedAt() {
        return transactionsUploadedAt;
    }
}
