package com.palexy.scheduler.autoschedule.engine;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SlotAssignerTest {

    private static final ShiftDef MORNING = new ShiftDef(1, 7, 15);
    private static final ShiftDef EVENING = new ShiftDef(2, 15, 23);
    private static final ShiftDef MIDDAY = new ShiftDef(3, 11, 15);

    private static ScheduleProblem problemOf(List<StaffDef> staff, ShiftDef... shifts) {
        return new ScheduleProblem(List.of(shifts), staff, List.of());
    }

    @Test
    void givesTheSlotToTheLeastUtilisedPersonAndBreaksTiesByLowerId() {
        ScheduleProblem problem = problemOf(
                List.of(new StaffDef(1, "A", 40), new StaffDef(2, "B", 20)), MORNING);
        List<Slot> slots = List.of(new Slot(1, MORNING), new Slot(2, MORNING), new Slot(3, MORNING));

        List<Placement> placements = SlotAssigner.assign(problem, slots);

        assertThat(placements).extracting(Placement::staffId).containsExactly(1L, 1L, 2L);
        assertThat(DraftRules.violations(problem, placements)).isEmpty();
    }

    @Test
    void neverGivesAnEightHourShiftToSomeoneWithFourHoursLeft() {
        ScheduleProblem problem = problemOf(List.of(new StaffDef(1, "A", 4)), MORNING);

        assertThat(SlotAssigner.assign(problem, List.of(new Slot(1, MORNING)))).isEmpty();
    }

    @Test
    void onePersonCanWorkASecondShiftTheSameDayButNotAnOverlappingOne() {
        ScheduleProblem problem = problemOf(List.of(new StaffDef(1, "A", 40)), MORNING, EVENING, MIDDAY);
        List<Slot> slots = List.of(new Slot(1, MORNING), new Slot(1, EVENING), new Slot(1, MIDDAY));

        List<Placement> placements = SlotAssigner.assign(problem, slots);

        assertThat(placements).extracting(Placement::shiftId).containsExactly(1L, 2L);
    }

    @Test
    void ruleCheckerFlagsOverMaximumOverlapAndDuplicates() {
        ScheduleProblem problem = problemOf(List.of(new StaffDef(1, "A", 8)), MORNING, MIDDAY);

        assertThat(DraftRules.violations(problem, List.of(new Placement(1, 1, 1), new Placement(2, 1, 1)))).isNotEmpty();
        assertThat(DraftRules.violations(problem, List.of(new Placement(1, 1, 1), new Placement(1, 3, 1)))).isNotEmpty();
        assertThat(DraftRules.violations(problem, List.of(new Placement(1, 1, 1), new Placement(1, 1, 1)))).isNotEmpty();
    }

    @Test
    void ruleCheckerAcceptsASplitDay() {
        ScheduleProblem problem = problemOf(
                List.of(new StaffDef(1, "A", 40)), new ShiftDef(1, 7, 10), new ShiftDef(2, 16, 21));

        assertThat(DraftRules.violations(problem, List.of(new Placement(1, 1, 1), new Placement(1, 2, 1)))).isEmpty();
    }
}
