package com.palexy.scheduler.autoschedule.engine;

import com.palexy.scheduler.transactions.TransactionCell;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ScoreCalculatorTest {

    private static final double EPS = 1e-3;

    private final ScheduleProblem problem = new ScheduleProblem(
            List.of(new ShiftDef(1, 7, 9)),
            Fixtures.team(3, 40),
            List.of(new TransactionCell(1, 7, 40), new TransactionCell(1, 8, 16)));

    @Test
    void oneShortPersonCostsTheUnservedTransactionsAndSomeUnfairness() {
        Score score = ScoreCalculator.evaluate(problem, List.of(new Placement(1, 1, 1)), Fixtures.PARAMS);

        assertThat(score.unmetTransactions()).isEqualTo(24);
        assertThat(score.idleCapacity()).isEqualTo(0);
        assertThat(score.fairness()).isCloseTo(42.667, within(EPS));
        assertThat(score.cost()).isCloseTo(50.133, within(EPS));
        assertThat(score.value()).isCloseTo(-50.133, within(EPS));
    }

    @Test
    void anEvenlyOverstaffedShiftCostsOnlyIdleCapacity() {
        List<Placement> everyone = List.of(new Placement(1, 1, 1), new Placement(1, 1, 2), new Placement(1, 1, 3));

        Score score = ScoreCalculator.evaluate(problem, everyone, Fixtures.PARAMS);

        assertThat(score.unmetTransactions()).isEqualTo(0);
        assertThat(score.idleCapacity()).isEqualTo(40);
        assertThat(score.fairness()).isEqualTo(0);
        assertThat(score.cost()).isEqualTo(40);
        assertThat(ScoreCalculator.coverage(problem, everyone)[1][7]).isEqualTo(3);
        assertThat(ScoreCalculator.coverage(problem, everyone)[2][7]).isEqualTo(0);
    }

    @Test
    void hoursBeyondTenInADayCountAsALongDay() {
        ScheduleProblem longShift = new ScheduleProblem(
                List.of(new ShiftDef(2, 7, 23)), Fixtures.team(3, 40), List.of());

        Score score = ScoreCalculator.evaluate(longShift, List.of(new Placement(1, 2, 1)), Fixtures.PARAMS);

        assertThat(score.longDays()).isEqualTo(96);
    }
}
