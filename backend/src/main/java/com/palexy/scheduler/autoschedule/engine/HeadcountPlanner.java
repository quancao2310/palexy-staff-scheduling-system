package com.palexy.scheduler.autoschedule.engine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Step 2: decides how many people each shift gets on each day.
 *
 * <p>The result is ordered by value. It starts with the cheapest set of shifts that covers every open hour once
 * per day (busiest day-shift first), then lists the extra people in the order they were worth adding. The
 * assigner works through the list in order, so a team that is too small loses the tail first.
 */
public final class HeadcountPlanner {

    private static final double MIN_GAIN = 1e-9;

    private HeadcountPlanner() {
    }

    public static List<Slot> plan(ScheduleProblem problem, SchedulerParams params) {
        List<Slot> slots = baseSlots(problem);
        addExtraPeople(problem, params, slots);
        return slots;
    }

    private static List<Slot> baseSlots(ScheduleProblem problem) {
        List<ShiftDef> cover = cheapestCover(problem);
        List<Slot> base = new ArrayList<>();
        for (int day = ScheduleProblem.FIRST_DAY; day <= ScheduleProblem.LAST_DAY; day++) {
            for (ShiftDef shift : cover) {
                base.add(new Slot(day, shift));
            }
        }
        base.sort(Comparator
                .comparingInt((Slot slot) -> -transactionsIn(problem, slot))
                .thenComparingInt(Slot::day)
                .thenComparingLong(slot -> slot.shift().id()));
        return base;
    }

    private static int transactionsIn(ScheduleProblem problem, Slot slot) {
        int total = 0;
        for (int hour = slot.shift().startHour(); hour < slot.shift().endHour(); hour++) {
            total += problem.transactions(slot.day(), hour);
        }
        return total;
    }

    /** Minimum total length of shifts covering every open hour; ties go to the lower shift id. */
    private static List<ShiftDef> cheapestCover(ScheduleProblem problem) {
        List<ShiftDef> shifts = problem.shifts().stream().sorted(Comparator.comparingLong(ShiftDef::id)).toList();
        int hours = ScheduleProblem.HOURS;
        int[] cost = new int[hours + 1];
        ShiftDef[] choice = new ShiftDef[hours + 1];
        for (int hour = hours - 1; hour >= 0; hour--) {
            if (!problem.isOpen(hour)) {
                cost[hour] = cost[hour + 1];
                continue;
            }
            cost[hour] = Integer.MAX_VALUE;
            for (ShiftDef shift : shifts) {
                if (shift.covers(hour) && shift.length() + cost[shift.endHour()] < cost[hour]) {
                    cost[hour] = shift.length() + cost[shift.endHour()];
                    choice[hour] = shift;
                }
            }
        }
        List<ShiftDef> cover = new ArrayList<>();
        int hour = 0;
        while (hour < hours) {
            if (!problem.isOpen(hour)) {
                hour++;
            } else {
                cover.add(choice[hour]);
                hour = choice[hour].endHour();
            }
        }
        return cover;
    }

    private static void addExtraPeople(ScheduleProblem problem, SchedulerParams params, List<Slot> slots) {
        int staffCount = problem.staff().size();
        int capacity = problem.totalCapacity();
        int[][] coverage = new int[ScheduleProblem.LAST_DAY + 1][ScheduleProblem.HOURS];
        int plannedHours = 0;
        for (Slot slot : slots) {
            addTo(coverage, slot, 1);
            plannedHours += slot.shift().length();
        }

        List<ShiftDef> byId = problem.shifts().stream().sorted(Comparator.comparingLong(ShiftDef::id)).toList();
        while (true) {
            Slot best = null;
            double bestGain = MIN_GAIN;
            for (int day = ScheduleProblem.FIRST_DAY; day <= ScheduleProblem.LAST_DAY; day++) {
                for (ShiftDef shift : byId) {
                    if (plannedHours + shift.length() > capacity || !fits(coverage[day], shift, staffCount)) {
                        continue;
                    }
                    double gain = gainOfAddingOne(problem, params, coverage[day], day, shift) / shift.length();
                    if (gain > bestGain) {
                        bestGain = gain;
                        best = new Slot(day, shift);
                    }
                }
            }
            if (best == null) {
                return;
            }
            slots.add(best);
            addTo(coverage, best, 1);
            plannedHours += best.shift().length();
        }
    }

    private static boolean fits(int[] dayCoverage, ShiftDef shift, int staffCount) {
        for (int hour = shift.startHour(); hour < shift.endHour(); hour++) {
            if (dayCoverage[hour] + 1 > staffCount) {
                return false;
            }
        }
        return true;
    }

    private static void addTo(int[][] coverage, Slot slot, int delta) {
        for (int hour = slot.shift().startHour(); hour < slot.shift().endHour(); hour++) {
            coverage[slot.day()][hour] += delta;
        }
    }

    /** Reduction of (shortfall + idle) cost, over the shift's hours, from putting one more person on it. */
    private static double gainOfAddingOne(ScheduleProblem problem, SchedulerParams params, int[] dayCoverage,
                                          int day, ShiftDef shift) {
        double gain = 0;
        for (int hour = shift.startHour(); hour < shift.endHour(); hour++) {
            int transactions = problem.transactions(day, hour);
            gain += hourCost(params, transactions, dayCoverage[hour])
                    - hourCost(params, transactions, dayCoverage[hour] + 1);
        }
        return gain;
    }

    private static double hourCost(SchedulerParams params, int transactions, int people) {
        int capacity = params.transactionsPerStaffHour() * people;
        return params.shortfallWeight() * Math.max(0, transactions - capacity)
                + params.idleWeight() * Math.max(0, capacity - transactions);
    }
}
