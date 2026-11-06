package com.palexy.scheduler.autoschedule.engine;

/** Required people for an hour: one per full N transactions, plus one if the leftover would keep them busy enough. */
public final class Need {

    private Need() {
    }

    public static int of(int transactions, SchedulerParams params) {
        int n = params.transactionsPerStaffHour();
        int full = transactions / n;
        int leftover = transactions % n;
        boolean extraPerson = leftover * (params.shortfallRatio() + 1) > n;
        return Math.max(1, full + (extraPerson ? 1 : 0));
    }
}
