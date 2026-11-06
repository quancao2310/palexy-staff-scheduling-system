package com.palexy.scheduler.autoschedule.engine;

import java.util.List;

/**
 * Drafts a weekly roster: plan the headcount per day-shift, assign people, improve with local search, report.
 * Pure and deterministic: the same problem always gives the same draft.
 */
public final class AutoScheduler {

    private AutoScheduler() {
    }

    public static Draft generate(ScheduleProblem problem, SchedulerParams params) {
        List<Slot> slots = HeadcountPlanner.plan(problem, params);
        List<Placement> assigned = SlotAssigner.assign(problem, slots);
        List<Placement> improved = LocalSearch.improve(problem, params, assigned);
        return DraftReporter.report(problem, params, improved);
    }
}
