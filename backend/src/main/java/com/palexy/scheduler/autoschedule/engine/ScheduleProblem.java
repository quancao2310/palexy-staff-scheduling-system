package com.palexy.scheduler.autoschedule.engine;

import com.palexy.scheduler.transactions.TransactionCell;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Everything the scheduler needs to know about one schedule. Immutable once built. */
public final class ScheduleProblem {

    public static final int FIRST_DAY = 1;
    public static final int LAST_DAY = 7;
    public static final int HOURS = 24;

    private final List<ShiftDef> shifts;
    private final List<StaffDef> staff;
    private final List<TransactionCell> demand;
    private final int[][] transactions = new int[LAST_DAY + 1][HOURS];
    private final boolean[] open = new boolean[HOURS];
    private final Map<Long, ShiftDef> shiftsById = new HashMap<>();
    private final Map<Long, Integer> staffIndex = new HashMap<>();

    public ScheduleProblem(List<ShiftDef> shifts, List<StaffDef> staff, List<TransactionCell> demand) {
        this.shifts = List.copyOf(shifts);
        this.staff = List.copyOf(staff);
        this.demand = List.copyOf(demand);
        for (TransactionCell cell : demand) {
            transactions[cell.day()][cell.hour()] = cell.transactions();
        }
        for (ShiftDef shift : shifts) {
            shiftsById.put(shift.id(), shift);
            for (int hour = shift.startHour(); hour < shift.endHour(); hour++) {
                open[hour] = true;
            }
        }
        for (int i = 0; i < staff.size(); i++) {
            staffIndex.put(staff.get(i).id(), i);
        }
    }

    public List<ShiftDef> shifts() {
        return shifts;
    }

    public List<StaffDef> staff() {
        return staff;
    }

    public List<TransactionCell> demand() {
        return demand;
    }

    /** Transactions in the clock hour; 0 when the data has no row for it. */
    public int transactions(int day, int hour) {
        return transactions[day][hour];
    }

    /** An hour is open (on every day) when at least one shift covers it. */
    public boolean isOpen(int hour) {
        return open[hour];
    }

    public ShiftDef shift(long id) {
        return shiftsById.get(id);
    }

    public int staffIndex(long staffId) {
        return staffIndex.get(staffId);
    }

    public int totalCapacity() {
        return staff.stream().mapToInt(StaffDef::maxWeeklyHours).sum();
    }
}
