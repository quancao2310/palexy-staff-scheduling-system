package com.palexy.scheduler.autoschedule.engine;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Test helper: lists every hard-rule violation of a roster. An empty list means the roster is valid. */
final class DraftRules {

    private DraftRules() {
    }

    static List<String> violations(ScheduleProblem problem, Collection<Placement> placements) {
        List<String> violations = new ArrayList<>();
        Map<Long, Integer> hours = new HashMap<>();
        Map<String, List<ShiftDef>> shiftsPerPersonDay = new HashMap<>();
        Set<Placement> seen = new HashSet<>();

        for (Placement placement : placements) {
            ShiftDef shift = problem.shift(placement.shiftId());
            boolean knownStaff = problem.staff().stream().anyMatch(s -> s.id() == placement.staffId());
            if (shift == null || !knownStaff) {
                violations.add("unknown shift or staff in " + placement);
                continue;
            }
            if (!seen.add(placement)) {
                violations.add("duplicate " + placement);
            }
            hours.merge(placement.staffId(), shift.length(), Integer::sum);
            List<ShiftDef> sameDay = shiftsPerPersonDay.computeIfAbsent(
                    placement.staffId() + "/" + placement.day(), key -> new ArrayList<>());
            for (ShiftDef other : sameDay) {
                if (other.overlaps(shift)) {
                    violations.add("staff " + placement.staffId() + " overlaps on day " + placement.day());
                }
            }
            sameDay.add(shift);
        }
        for (StaffDef person : problem.staff()) {
            int worked = hours.getOrDefault(person.id(), 0);
            if (worked > person.maxWeeklyHours()) {
                violations.add(person.name() + " works " + worked + "h, max " + person.maxWeeklyHours());
            }
        }
        return violations;
    }
}
