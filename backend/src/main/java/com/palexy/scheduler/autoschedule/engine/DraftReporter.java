package com.palexy.scheduler.autoschedule.engine;

import java.time.DayOfWeek;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Step 5: turns a finished roster into the warnings and totals the manager sees. */
public final class DraftReporter {

    /** A person is under-utilised when their utilisation is below this share of the team average. */
    static final double UNDER_UTILISED_SHARE = 0.5;

    private DraftReporter() {
    }

    public static Draft report(ScheduleProblem problem, SchedulerParams params, List<Placement> placements) {
        int[][] coverage = ScoreCalculator.coverage(problem, placements);
        List<Warning> warnings = new ArrayList<>();
        int shortfall = 0;

        for (int day = ScheduleProblem.FIRST_DAY; day <= ScheduleProblem.LAST_DAY; day++) {
            for (int hour = 0; hour < ScheduleProblem.HOURS; hour++) {
                int transactions = problem.transactions(day, hour);
                if (problem.isOpen(hour)) {
                    int needed = Need.of(transactions, params);
                    int scheduled = coverage[day][hour];
                    if (scheduled < needed) {
                        shortfall += needed - scheduled;
                        warnings.add(new Warning(WarningType.UNDERSTAFFED, day, hour, null, needed, scheduled,
                                "%s %s needs %s, has %d".formatted(dayName(day), clock(hour), people(needed), scheduled)));
                    }
                } else if (transactions > 0) {
                    warnings.add(new Warning(WarningType.UNCOVERED_HOUR, day, hour, null, null, null,
                            "%s %s has %d transactions but no shift covers it. Add a shift for this time."
                                    .formatted(dayName(day), clock(hour), transactions)));
                }
            }
        }

        List<StaffLoad> loads = staffLoads(problem, placements);
        addUnderUtilised(problem, loads, warnings);
        warnings.sort(Comparator
                .comparingInt((Warning w) -> w.type().ordinal())
                .thenComparingInt(w -> w.day() == null ? 0 : w.day())
                .thenComparingInt(w -> w.hour() == null ? 0 : w.hour())
                .thenComparingLong(w -> w.staffId() == null ? 0 : w.staffId()));

        Score score = ScoreCalculator.evaluate(problem, placements, params);
        Stats stats = new Stats(shortfall, round(score.unmetTransactions()),
                round(score.idleCapacity() / params.transactionsPerStaffHour()), round(score.value()), loads);
        List<Placement> sorted = placements.stream()
                .sorted(Comparator.comparingInt(Placement::day)
                        .thenComparingLong(Placement::shiftId)
                        .thenComparingLong(Placement::staffId))
                .toList();
        return new Draft(sorted, warnings, stats);
    }

    private static List<StaffLoad> staffLoads(ScheduleProblem problem, List<Placement> placements) {
        int[] hours = new int[problem.staff().size()];
        for (Placement placement : placements) {
            hours[problem.staffIndex(placement.staffId())] += problem.shift(placement.shiftId()).length();
        }
        List<StaffLoad> loads = new ArrayList<>();
        for (int i = 0; i < hours.length; i++) {
            StaffDef person = problem.staff().get(i);
            loads.add(new StaffLoad(person.id(), person.name(), hours[i], person.maxWeeklyHours(),
                    (double) hours[i] / person.maxWeeklyHours()));
        }
        return loads;
    }

    private static void addUnderUtilised(ScheduleProblem problem, List<StaffLoad> loads, List<Warning> warnings) {
        int shortestShift = problem.shifts().stream().mapToInt(ShiftDef::length).min().orElse(0);
        for (StaffLoad load : loads) {
            if (load.maxHours() < shortestShift) {
                warnings.add(new Warning(WarningType.UNDER_UTILISED, null, null, load.staffId(), null, null,
                        "%s can't be scheduled: their maximum of %d hours is below the shortest shift (%d hours)"
                                .formatted(load.name(), load.maxHours(), shortestShift)));
            }
        }
        int totalHours = loads.stream().mapToInt(StaffLoad::hours).sum();
        int totalCapacity = problem.totalCapacity();
        if (totalHours == 0 || totalCapacity == 0) {
            return;
        }
        double average = (double) totalHours / totalCapacity;
        for (StaffLoad load : loads) {
            if (load.maxHours() >= shortestShift && load.utilisation() < UNDER_UTILISED_SHARE * average) {
                warnings.add(new Warning(WarningType.UNDER_UTILISED, null, null, load.staffId(), null, null,
                        "%s is scheduled for %d of %d hours".formatted(load.name(), load.hours(), load.maxHours())));
            }
        }
    }

    private static String dayName(int day) {
        return DayOfWeek.of(day).getDisplayName(TextStyle.FULL, Locale.ENGLISH);
    }

    private static String clock(int hour) {
        return "%02d:00".formatted(hour);
    }

    private static String people(int count) {
        return count == 1 ? "1 person" : count + " people";
    }

    private static double round(double value) {
        return Math.round(value * 10) / 10.0;
    }
}
