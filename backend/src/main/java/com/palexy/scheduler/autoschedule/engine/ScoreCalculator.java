package com.palexy.scheduler.autoschedule.engine;

import java.util.Collection;

/** Scores a roster; the one place the cost terms are defined. */
public final class ScoreCalculator {

    private ScoreCalculator() {
    }

    /** {@code coverage[day][hour]}: how many people are on shift (day 1..7, hour 0..23). */
    public static int[][] coverage(ScheduleProblem problem, Collection<Placement> placements) {
        int[][] coverage = new int[ScheduleProblem.LAST_DAY + 1][ScheduleProblem.HOURS];
        for (Placement placement : placements) {
            ShiftDef shift = problem.shift(placement.shiftId());
            for (int hour = shift.startHour(); hour < shift.endHour(); hour++) {
                coverage[placement.day()][hour]++;
            }
        }
        return coverage;
    }

    public static Score evaluate(ScheduleProblem problem, Collection<Placement> placements, SchedulerParams params) {
        int n = params.transactionsPerStaffHour();
        int[][] coverage = coverage(problem, placements);

        double unmet = 0;
        double idle = 0;
        for (int day = ScheduleProblem.FIRST_DAY; day <= ScheduleProblem.LAST_DAY; day++) {
            for (int hour = 0; hour < ScheduleProblem.HOURS; hour++) {
                int transactions = problem.transactions(day, hour);
                if (!problem.isOpen(hour) && transactions == 0) {
                    continue;
                }
                int capacity = n * coverage[day][hour];
                unmet += Math.max(0, transactions - capacity);
                idle += Math.max(0, capacity - transactions);
            }
        }

        int staffCount = problem.staff().size();
        int[] hours = new int[staffCount];
        int[][] dayHours = new int[staffCount][ScheduleProblem.LAST_DAY + 1];
        int totalHours = 0;
        for (Placement placement : placements) {
            int length = problem.shift(placement.shiftId()).length();
            int index = problem.staffIndex(placement.staffId());
            hours[index] += length;
            dayHours[index][placement.day()] += length;
            totalHours += length;
        }

        double fairness = 0;
        double longDays = 0;
        int totalCapacity = problem.totalCapacity();
        double utilisation = totalCapacity == 0 ? 0 : (double) totalHours / totalCapacity;
        for (int i = 0; i < staffCount; i++) {
            double deviation = hours[i] - utilisation * problem.staff().get(i).maxWeeklyHours();
            fairness += deviation * deviation;
            for (int day = ScheduleProblem.FIRST_DAY; day <= ScheduleProblem.LAST_DAY; day++) {
                longDays += Math.max(0, dayHours[i][day] - params.longDayThresholdHours());
            }
        }
        fairness *= n;
        longDays *= n;

        double cost = params.shortfallWeight() * unmet + params.idleWeight() * idle
                + params.fairnessWeight() * fairness + params.longDayWeight() * longDays;
        return new Score(unmet, idle, fairness, longDays, cost);
    }
}
