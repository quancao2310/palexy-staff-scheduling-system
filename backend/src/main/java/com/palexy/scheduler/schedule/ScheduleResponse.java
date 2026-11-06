package com.palexy.scheduler.schedule;

import java.time.Instant;

public record ScheduleResponse(
        Long id,
        String name,
        Instant createdAt,
        Instant updatedAt,
        long staffCount,
        long shiftCount,
        boolean hasTransactions,
        String transactionsFileName,
        Instant transactionsUploadedAt) {

    static ScheduleResponse of(Schedule schedule, long staffCount, long shiftCount) {
        return new ScheduleResponse(schedule.getId(), schedule.getName(), schedule.getCreatedAt(),
                schedule.getUpdatedAt(), staffCount, shiftCount, schedule.getTransactionsUploadedAt() != null,
                schedule.getTransactionsFileName(), schedule.getTransactionsUploadedAt());
    }
}
