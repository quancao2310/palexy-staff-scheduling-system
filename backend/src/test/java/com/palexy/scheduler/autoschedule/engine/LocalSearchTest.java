package com.palexy.scheduler.autoschedule.engine;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LocalSearchTest {

    private static final ShiftDef MORNING = new ShiftDef(1, 7, 15);

    private static ScheduleProblem problem(int staffCount) {
        return new ScheduleProblem(List.of(MORNING), Fixtures.team(staffCount, 40), Fixtures.flatDemand(16));
    }

    private static List<Placement> days(long staffId, int from, int to) {
        List<Placement> placements = new ArrayList<>();
        for (int day = from; day <= to; day++) {
            placements.add(new Placement(day, 1, staffId));
        }
        return placements;
    }

    private static int hoursOf(List<Placement> placements, long staffId) {
        return (int) placements.stream().filter(p -> p.staffId() == staffId).count() * 8;
    }

    @Test
    void evensOutAnUnbalancedWeekWithoutBreakingCoverageOrRules() {
        ScheduleProblem problem = problem(2);
        List<Placement> start = new ArrayList<>(days(1, 1, 5));
        start.addAll(days(2, 6, 7));

        List<Placement> result = LocalSearch.improve(problem, Fixtures.PARAMS, start);

        assertThat(ScoreCalculator.evaluate(problem, result, Fixtures.PARAMS).cost())
                .isLessThan(ScoreCalculator.evaluate(problem, start, Fixtures.PARAMS).cost());
        assertThat(Math.abs(hoursOf(result, 1) - hoursOf(result, 2))).isLessThanOrEqualTo(8);
        int[][] coverage = ScoreCalculator.coverage(problem, result);
        for (int day = 1; day <= 7; day++) {
            assertThat(coverage[day][7]).isGreaterThanOrEqualTo(1);
        }
        assertThat(DraftRules.violations(problem, result)).isEmpty();
    }

    @Test
    void theResultIsALocalOptimum() {
        ScheduleProblem problem = problem(2);
        List<Placement> start = new ArrayList<>(days(1, 1, 5));
        start.addAll(days(2, 6, 7));

        List<Placement> result = LocalSearch.improve(problem, Fixtures.PARAMS, start);

        assertThat(LocalSearch.findImprovement(problem, Fixtures.PARAMS, result)).isEmpty();
    }

    @Test
    void zeroMovesLeavesTheInputUnchanged() {
        ScheduleProblem problem = problem(2);
        List<Placement> start = days(1, 1, 7);
        SchedulerParams noMoves = new SchedulerParams(16, 2, 1, 1, 1, 10, 0);

        assertThat(LocalSearch.improve(problem, noMoves, start)).isEqualTo(start);
    }

    @Test
    void someoneWithNoHoursGetsAShiftAndNoHourIsOverstaffedByMoreThanOne() {
        ScheduleProblem problem = problem(3);
        List<Placement> start = new ArrayList<>(days(1, 1, 4));
        start.addAll(days(2, 5, 7));

        List<Placement> result = LocalSearch.improve(problem, Fixtures.PARAMS, start);

        assertThat(hoursOf(result, 3)).isGreaterThanOrEqualTo(8);
        for (int[] day : ScoreCalculator.coverage(problem, result)) {
            for (int people : day) {
                assertThat(people).isLessThanOrEqualTo(2);
            }
        }
        assertThat(DraftRules.violations(problem, result)).isEmpty();
    }
}
