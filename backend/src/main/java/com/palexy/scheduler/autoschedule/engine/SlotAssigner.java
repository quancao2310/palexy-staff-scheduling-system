package com.palexy.scheduler.autoschedule.engine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Step 3: gives each slot, in order, to the eligible person who would end up the least utilised
 * (hours ÷ maximum hours). A slot nobody can take is skipped; the report turns that into a shortage warning.
 */
public final class SlotAssigner {

    private SlotAssigner() {
    }

    public static List<Placement> assign(ScheduleProblem problem, List<Slot> orderedSlots) {
        List<StaffDef> staff = problem.staff().stream().sorted(Comparator.comparingLong(StaffDef::id)).toList();
        int[] hours = new int[staff.size()];
        List<List<ShiftDef>> shiftsByStaffDay = new ArrayList<>();
        for (int i = 0; i < staff.size() * (ScheduleProblem.LAST_DAY + 1); i++) {
            shiftsByStaffDay.add(new ArrayList<>());
        }

        List<Placement> placements = new ArrayList<>();
        for (Slot slot : orderedSlots) {
            int length = slot.shift().length();
            int chosen = -1;
            double chosenUtilisation = Double.MAX_VALUE;
            for (int i = 0; i < staff.size(); i++) {
                StaffDef person = staff.get(i);
                if (hours[i] + length > person.maxWeeklyHours()
                        || overlapsExisting(shiftsByStaffDay.get(slotIndex(i, slot.day())), slot.shift())) {
                    continue;
                }
                double utilisation = (double) (hours[i] + length) / person.maxWeeklyHours();
                if (utilisation < chosenUtilisation) {
                    chosenUtilisation = utilisation;
                    chosen = i;
                }
            }
            if (chosen >= 0) {
                hours[chosen] += length;
                shiftsByStaffDay.get(slotIndex(chosen, slot.day())).add(slot.shift());
                placements.add(new Placement(slot.day(), slot.shift().id(), staff.get(chosen).id()));
            }
        }
        return placements;
    }

    private static int slotIndex(int staffIndex, int day) {
        return staffIndex * (ScheduleProblem.LAST_DAY + 1) + day;
    }

    private static boolean overlapsExisting(List<ShiftDef> existing, ShiftDef candidate) {
        for (ShiftDef shift : existing) {
            if (shift.overlaps(candidate)) {
                return true;
            }
        }
        return false;
    }
}
