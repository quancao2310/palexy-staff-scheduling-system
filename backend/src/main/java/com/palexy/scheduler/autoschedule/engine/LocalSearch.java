package com.palexy.scheduler.autoschedule.engine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Step 4: repairs the greedy result by trying single moves and keeping any that lower the cost.
 *
 * <p>Moves, scanned in a fixed order so the outcome is deterministic: reassign a placement to someone else,
 * swap two people's placements, add a person to a day-shift (never above {@code need + 1} in any hour: the
 * agreed "overstaff a little"), remove a person from a day-shift. No move may break a hard rule or leave an hour
 * that had someone on shift with nobody.
 *
 * <p>Work is bounded two ways, both deterministic: at most {@code maxMoves} accepted moves, and at most
 * {@link #MAX_CANDIDATES} candidate moves examined in one {@link #improve} call. The second keeps a very large
 * team from holding up the request; when it runs out the roster so far is returned (still valid, just less polished).
 */
public final class LocalSearch {

    /**
     * Candidate moves examined per {@link #improve} call, about a second or so of work at worst. The sample week needs
     * a few thousand; only a very large store (40 staff, 6 shifts, eight times the sample demand) reaches it.
     */
    static final long MAX_CANDIDATES = 100_000;

    private static final double MIN_IMPROVEMENT = 1e-9;

    private LocalSearch() {
    }

    public static List<Placement> improve(ScheduleProblem problem, SchedulerParams params, List<Placement> start) {
        Budget budget = new Budget(MAX_CANDIDATES);
        List<Placement> current = List.copyOf(start);
        for (int moves = 0; moves < params.maxMoves() && !budget.exhausted(); moves++) {
            Optional<List<Placement>> better = scan(problem, params, current, budget);
            if (better.isEmpty()) {
                break;
            }
            current = better.get();
        }
        return current;
    }

    /** The first improving single move in scan order, or empty when {@code current} is a local optimum. */
    public static Optional<List<Placement>> findImprovement(ScheduleProblem problem, SchedulerParams params,
                                                            List<Placement> current) {
        return scan(problem, params, current, new Budget(Long.MAX_VALUE));
    }

    private static Optional<List<Placement>> scan(ScheduleProblem problem, SchedulerParams params,
                                                  List<Placement> current, Budget budget) {
        double baseline = ScoreCalculator.evaluate(problem, current, params).cost();
        int[][] coverage = ScoreCalculator.coverage(problem, current);
        List<StaffDef> staff = problem.staff().stream().sorted(Comparator.comparingLong(StaffDef::id)).toList();
        List<ShiftDef> shifts = problem.shifts().stream().sorted(Comparator.comparingLong(ShiftDef::id)).toList();

        for (int i = 0; i < current.size() && !budget.exhausted(); i++) {
            Placement placement = current.get(i);
            for (StaffDef person : staff) {
                if (person.id() != placement.staffId()) {
                    List<Placement> candidate = new ArrayList<>(current);
                    candidate.set(i, new Placement(placement.day(), placement.shiftId(), person.id()));
                    if (accepts(problem, params, candidate, baseline, coverage, budget)) {
                        return Optional.of(candidate);
                    }
                }
            }
        }
        for (int i = 0; i < current.size() && !budget.exhausted(); i++) {
            for (int j = i + 1; j < current.size(); j++) {
                Placement a = current.get(i);
                Placement b = current.get(j);
                if (a.staffId() != b.staffId()) {
                    List<Placement> candidate = new ArrayList<>(current);
                    candidate.set(i, new Placement(a.day(), a.shiftId(), b.staffId()));
                    candidate.set(j, new Placement(b.day(), b.shiftId(), a.staffId()));
                    if (accepts(problem, params, candidate, baseline, coverage, budget)) {
                        return Optional.of(candidate);
                    }
                }
            }
        }
        for (int day = ScheduleProblem.FIRST_DAY; day <= ScheduleProblem.LAST_DAY && !budget.exhausted(); day++) {
            for (ShiftDef shift : shifts) {
                if (!withinSurplusCap(problem, params, coverage, day, shift)) {
                    continue;
                }
                for (StaffDef person : staff) {
                    List<Placement> candidate = new ArrayList<>(current);
                    candidate.add(new Placement(day, shift.id(), person.id()));
                    if (accepts(problem, params, candidate, baseline, coverage, budget)) {
                        return Optional.of(candidate);
                    }
                }
            }
        }
        for (int i = 0; i < current.size() && !budget.exhausted(); i++) {
            List<Placement> candidate = new ArrayList<>(current);
            candidate.remove(i);
            if (accepts(problem, params, candidate, baseline, coverage, budget)) {
                return Optional.of(candidate);
            }
        }
        return Optional.empty();
    }

    private static boolean accepts(ScheduleProblem problem, SchedulerParams params, List<Placement> candidate,
                                   double baseline, int[][] coverage, Budget budget) {
        budget.spend();
        if (!respectsHardRules(problem, candidate)) {
            return false;
        }
        if (ScoreCalculator.evaluate(problem, candidate, params).cost() >= baseline - MIN_IMPROVEMENT) {
            return false;
        }
        int[][] after = ScoreCalculator.coverage(problem, candidate);
        for (int day = ScheduleProblem.FIRST_DAY; day <= ScheduleProblem.LAST_DAY; day++) {
            for (int hour = 0; hour < ScheduleProblem.HOURS; hour++) {
                if (coverage[day][hour] > 0 && after[day][hour] == 0) {
                    return false;
                }
            }
        }
        return true;
    }

    private static boolean withinSurplusCap(ScheduleProblem problem, SchedulerParams params, int[][] coverage,
                                            int day, ShiftDef shift) {
        for (int hour = shift.startHour(); hour < shift.endHour(); hour++) {
            if (coverage[day][hour] + 1 > Need.of(problem.transactions(day, hour), params) + 1) {
                return false;
            }
        }
        return true;
    }

    /**
     * Maximum hours, no overlapping shifts for one person on one day, no duplicate placement.
     * Linear in the number of placements: shifts are grouped per person and day, and each group is tiny.
     */
    private static boolean respectsHardRules(ScheduleProblem problem, List<Placement> placements) {
        int staffCount = problem.staff().size();
        int[] hours = new int[staffCount];
        @SuppressWarnings("unchecked")
        List<ShiftDef>[] byPersonDay = new List[staffCount * (ScheduleProblem.LAST_DAY + 1)];
        for (Placement placement : placements) {
            ShiftDef shift = problem.shift(placement.shiftId());
            int person = problem.staffIndex(placement.staffId());
            hours[person] += shift.length();
            if (hours[person] > problem.staff().get(person).maxWeeklyHours()) {
                return false;
            }
            int key = person * (ScheduleProblem.LAST_DAY + 1) + placement.day();
            List<ShiftDef> sameDay = byPersonDay[key];
            if (sameDay == null) {
                sameDay = new ArrayList<>(2);
                byPersonDay[key] = sameDay;
            }
            for (ShiftDef other : sameDay) {
                if (other.overlaps(shift)) {
                    return false;
                }
            }
            sameDay.add(shift);
        }
        return true;
    }

    /** Counts examined candidates so a huge input cannot run unbounded. */
    private static final class Budget {
        private long left;

        Budget(long total) {
            this.left = total;
        }

        void spend() {
            left--;
        }

        boolean exhausted() {
            return left <= 0;
        }
    }
}
