package com.palexy.scheduler.transactions;

import com.palexy.scheduler.common.error.ResourceNotFoundException;
import com.palexy.scheduler.schedule.Schedule;
import com.palexy.scheduler.schedule.ScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@Transactional
public class TransactionService {

    private final TransactionCountRepository counts;
    private final ScheduleRepository schedules;

    public TransactionService(TransactionCountRepository counts, ScheduleRepository schedules) {
        this.counts = counts;
        this.schedules = schedules;
    }

    @Transactional(readOnly = true)
    public TransactionsResponse get(Long scheduleId) {
        Schedule schedule = find(scheduleId);
        return toResponse(schedule, counts.findAll(scheduleId), List.of());
    }

    public TransactionsResponse replace(Long scheduleId, String fileName, byte[] content) {
        Schedule schedule = find(scheduleId);
        ParsedReport report = TransactionReportParser.parse(content);
        counts.deleteAll(scheduleId);
        counts.insertAll(scheduleId, report.cells());
        schedule.recordUpload(displayName(fileName));
        schedules.save(schedule);
        return toResponse(schedule, report.cells(), report.warnings());
    }

    public void clear(Long scheduleId) {
        Schedule schedule = find(scheduleId);
        counts.deleteAll(scheduleId);
        schedule.clearUpload();
        schedules.save(schedule);
    }

    private TransactionsResponse toResponse(Schedule schedule, List<TransactionCell> cells, List<String> warnings) {
        long total = cells.stream().mapToLong(TransactionCell::transactions).sum();
        TransactionCell peak = cells.stream()
                .max(Comparator.comparingInt(TransactionCell::transactions))
                .filter(cell -> cell.transactions() > 0)
                .orElse(null);
        return new TransactionsResponse(!cells.isEmpty(), schedule.getTransactionsFileName(),
                schedule.getTransactionsUploadedAt(), cells, total, peak, warnings);
    }

    private static String displayName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "transactions.csv";
        }
        String name = fileName.substring(Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\')) + 1).strip();
        if (name.isEmpty()) {
            return "transactions.csv";
        }
        return name.length() > 255 ? name.substring(0, 255) : name;
    }

    private Schedule find(Long scheduleId) {
        return schedules.findById(scheduleId).orElseThrow(() -> new ResourceNotFoundException("Schedule", scheduleId));
    }
}
