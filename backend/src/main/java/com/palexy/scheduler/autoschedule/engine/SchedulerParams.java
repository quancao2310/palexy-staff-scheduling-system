package com.palexy.scheduler.autoschedule.engine;

/**
 * Tunables of the scheduler. All costs are in transaction units (one staff-hour of capacity = N transactions).
 *
 * @param transactionsPerStaffHour N: transactions one person handles per hour
 * @param shortfallWeight          cost of one unserved transaction (k = shortfallWeight / idleWeight)
 * @param idleWeight               cost of one transaction of unused capacity
 * @param fairnessWeight           weight of the squared deviation from an even utilisation
 * @param longDayWeight            weight of hours worked beyond the threshold in one day
 * @param longDayThresholdHours    hours in one day after which a day counts as long
 * @param maxMoves                 cap on accepted improvement moves
 */
public record SchedulerParams(
        int transactionsPerStaffHour,
        double shortfallWeight,
        double idleWeight,
        double fairnessWeight,
        double longDayWeight,
        int longDayThresholdHours,
        int maxMoves) {

    /**
     * Tuned values: shortfall 2 and idle 1 (the owner's "short is twice as bad as idle"), long day 1 over 10 h.
     * Fairness is 0.05, not 1: shifts are 8-hour lumps, and at weight 1 the search deleted shifts of real demand
     * (unmet transactions 289 -> 459 for 8 staff) just to make everyone's total hours identical. At 0.05 fairness
     * decides who works the shifts and lifts people who would get almost nothing, but does not change how many
     * shifts there are.
     */
    public static SchedulerParams defaults(int transactionsPerStaffHour) {
        return new SchedulerParams(transactionsPerStaffHour, 2, 1, 0.05, 1, 10, 2000);
    }

    /** How many times worse a missing person is than an idle one. */
    public double shortfallRatio() {
        return shortfallWeight / idleWeight;
    }
}
