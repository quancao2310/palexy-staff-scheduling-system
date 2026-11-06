package com.palexy.scheduler.autoschedule.engine;

import com.palexy.scheduler.transactions.TransactionCell;
import com.palexy.scheduler.transactions.TransactionReportParser;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;

/** Shared test data: the sample week, the default shifts and anonymous teams. */
final class Fixtures {

    static final SchedulerParams PARAMS = SchedulerParams.defaults(16);

    private Fixtures() {
    }

    static List<TransactionCell> sampleDemand() {
        try {
            byte[] csv = new ClassPathResource("demo/sample_transaction_interview.csv").getContentAsByteArray();
            return TransactionReportParser.parse(csv).cells();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static List<ShiftDef> defaultShifts() {
        return List.of(new ShiftDef(1, 7, 15), new ShiftDef(2, 15, 23));
    }

    static List<StaffDef> team(int count, int maxHours) {
        List<StaffDef> staff = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            staff.add(new StaffDef(i, "Staff " + i, maxHours));
        }
        return staff;
    }

    static ScheduleProblem sample(int staffCount, int maxHours) {
        return new ScheduleProblem(defaultShifts(), team(staffCount, maxHours), sampleDemand());
    }

    /** The same demand in every hour of every day. */
    static List<TransactionCell> flatDemand(int transactions) {
        List<TransactionCell> cells = new ArrayList<>();
        for (int day = 1; day <= 7; day++) {
            for (int hour = 0; hour < 24; hour++) {
                cells.add(new TransactionCell(day, hour, transactions));
            }
        }
        return cells;
    }
}
