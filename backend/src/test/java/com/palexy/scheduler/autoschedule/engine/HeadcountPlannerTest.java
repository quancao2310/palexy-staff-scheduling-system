package com.palexy.scheduler.autoschedule.engine;

import com.palexy.scheduler.transactions.TransactionCell;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class HeadcountPlannerTest {

    @Test
    void theFirstSlotsCoverEveryDayShiftOnceBusiestFirst() {
        ScheduleProblem problem = Fixtures.sample(12, 40);

        List<Slot> slots = HeadcountPlanner.plan(problem, Fixtures.PARAMS);

        Set<String> covered = new HashSet<>();
        List<Integer> totals = new ArrayList<>();
        for (Slot slot : slots.subList(0, 14)) {
            covered.add(slot.day() + "/" + slot.shift().id());
            int total = 0;
            for (int hour = slot.shift().startHour(); hour < slot.shift().endHour(); hour++) {
                total += problem.transactions(slot.day(), hour);
            }
            totals.add(total);
        }
        assertThat(covered).hasSize(14);
        assertThat(totals).isSortedAccordingTo((a, b) -> Integer.compare(b, a));
    }

    @Test
    void aShortPeakShiftIsPreferredOverStretchingALongOne() {
        List<ShiftDef> shifts = List.of(new ShiftDef(1, 7, 15), new ShiftDef(2, 15, 23), new ShiftDef(3, 11, 15));
        List<TransactionCell> demand = new ArrayList<>();
        for (int hour = 7; hour < 23; hour++) {
            demand.add(new TransactionCell(1, hour, hour >= 11 && hour < 15 ? 64 : 16));
        }
        ScheduleProblem problem = new ScheduleProblem(shifts, Fixtures.team(10, 40), demand);

        List<Slot> slots = HeadcountPlanner.plan(problem, Fixtures.PARAMS);

        assertThat(slots.stream().filter(s -> s.day() == 1 && s.shift().id() == 3)).hasSize(3);
        assertThat(slots.stream().filter(s -> s.day() == 1 && s.shift().id() == 1)).hasSize(1);
    }

    @Test
    void aTeamTooSmallForEvenTheBaseCoverGetsNothingExtra() {
        List<Slot> slots = HeadcountPlanner.plan(Fixtures.sample(2, 40), Fixtures.PARAMS);

        assertThat(slots).hasSize(14);
    }

    @Test
    void neverPlansMorePeopleAtOnceThanTheTeamHas() {
        ScheduleProblem problem = new ScheduleProblem(
                Fixtures.defaultShifts(), Fixtures.team(2, 100), Fixtures.flatDemand(100));

        List<Slot> slots = HeadcountPlanner.plan(problem, Fixtures.PARAMS);

        List<Placement> asPlacements = slots.stream().map(s -> new Placement(s.day(), s.shift().id(), 0)).toList();
        int[][] coverage = ScoreCalculator.coverage(problem, asPlacements);
        int most = 0;
        for (int[] day : coverage) {
            for (int people : day) {
                most = Math.max(most, people);
            }
        }
        assertThat(most).isEqualTo(2);
        assertThat(slots.stream().mapToInt(s -> s.shift().length()).sum()).isLessThanOrEqualTo(200);
    }

    @Test
    void addsNobodyWhenOnePersonPerHourAlreadyMatchesDemand() {
        ScheduleProblem problem = new ScheduleProblem(
                Fixtures.defaultShifts(), Fixtures.team(10, 40), Fixtures.flatDemand(16));

        assertThat(HeadcountPlanner.plan(problem, Fixtures.PARAMS)).hasSize(14);
    }
}
