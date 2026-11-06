package com.palexy.scheduler.autoschedule.engine;

import java.util.List;

/**
 * @param shortfallStaffHours total missing person-hours against the fixed need
 * @param unmetTransactions   transactions beyond what the people on shift can handle
 * @param idleStaffHours      unused capacity, in staff-hours
 * @param score               the maximized value (negated cost, higher is better)
 */
public record Stats(int shortfallStaffHours, double unmetTransactions, double idleStaffHours, double score,
                    List<StaffLoad> staff) {
}
