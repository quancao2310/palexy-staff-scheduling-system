package com.palexy.scheduler.roster;

import com.palexy.scheduler.common.error.FieldProblemException;
import com.palexy.scheduler.common.error.ResourceNotFoundException;
import com.palexy.scheduler.schedule.ScheduleRepository;
import com.palexy.scheduler.shift.ShiftRepository;
import com.palexy.scheduler.staff.Staff;
import com.palexy.scheduler.staff.StaffRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class RosterService {

    private final AssignmentRepository assignments;
    private final ScheduleRepository schedules;
    private final ShiftRepository shifts;
    private final StaffRepository staff;

    public RosterService(AssignmentRepository assignments, ScheduleRepository schedules, ShiftRepository shifts,
                         StaffRepository staff) {
        this.assignments = assignments;
        this.schedules = schedules;
        this.shifts = shifts;
        this.staff = staff;
    }

    public List<AssignmentResponse> list(Long scheduleId) {
        requireSchedule(scheduleId);
        return assignments.findByScheduleIdOrderByDayOfWeekAscShiftIdAscStaffIdAsc(scheduleId).stream()
                .map(AssignmentResponse::of).toList();
    }

    /**
     * Puts one person on one shift on one day. Only integrity is checked here (the shift and the person
     * belong to the schedule, no duplicate); maximum hours and understaffing are the manager's call and
     * are surfaced by the UI.
     */
    @Transactional
    public AssignmentResponse add(Long scheduleId, AssignmentRequest request) {
        requireSchedule(scheduleId);
        shifts.findByIdAndScheduleId(request.shiftId(), scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Shift", request.shiftId()));
        Staff person = staff.findByIdAndScheduleId(request.staffId(), scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff", request.staffId()));
        if (assignments.existsByScheduleIdAndDayOfWeekAndShiftIdAndStaffId(
                scheduleId, request.day(), request.shiftId(), request.staffId())) {
            throw FieldProblemException.conflict("staffId", person.getName() + " is already on this shift");
        }
        return AssignmentResponse.of(assignments.saveAndFlush(
                new Assignment(scheduleId, request.day(), request.shiftId(), request.staffId())));
    }

    @Transactional
    public void remove(Long scheduleId, Long assignmentId) {
        Assignment assignment = assignments.findByIdAndScheduleId(assignmentId, scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment", assignmentId));
        assignments.delete(assignment);
    }

    private void requireSchedule(Long scheduleId) {
        if (!schedules.existsById(scheduleId)) {
            throw new ResourceNotFoundException("Schedule", scheduleId);
        }
    }
}
