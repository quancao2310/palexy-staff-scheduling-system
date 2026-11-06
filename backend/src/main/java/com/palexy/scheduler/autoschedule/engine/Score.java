package com.palexy.scheduler.autoschedule.engine;

/**
 * Cost breakdown of a roster. The first four fields are raw (unweighted) amounts in transaction units;
 * {@code cost} is their weighted sum, lower is better.
 */
public record Score(double unmetTransactions, double idleCapacity, double fairness, double longDays, double cost) {

    /** Higher is better. */
    public double value() {
        return -cost;
    }
}
