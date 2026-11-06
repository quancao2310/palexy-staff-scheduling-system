package com.palexy.scheduler.autoschedule;

import com.palexy.scheduler.autoschedule.engine.AutoScheduler;
import com.palexy.scheduler.autoschedule.engine.Draft;
import com.palexy.scheduler.autoschedule.engine.ScheduleProblem;
import com.palexy.scheduler.autoschedule.engine.SchedulerParams;
import com.palexy.scheduler.autoschedule.engine.ShiftDef;
import com.palexy.scheduler.autoschedule.engine.StaffDef;
import com.palexy.scheduler.common.error.FieldProblemException;
import com.palexy.scheduler.common.error.ResourceNotFoundException;
import com.palexy.scheduler.roster.Assignment;
import com.palexy.scheduler.roster.AssignmentRepository;
import com.palexy.scheduler.roster.AssignmentResponse;
import com.palexy.scheduler.schedule.ScheduleRepository;
import com.palexy.scheduler.shift.ShiftRepository;
import com.palexy.scheduler.staff.StaffRepository;
import com.palexy.scheduler.transactions.TransactionCell;
import com.palexy.scheduler.transactions.TransactionCountRepository;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
@EnableConfigurationProperties(SchedulerProperties.class)
public class AutoScheduleService {

    private final ScheduleRepository schedules;
    private final StaffRepository staff;
    private final ShiftRepository shifts;
    private final TransactionCountRepository transactions;
    private final AssignmentRepository assignments;
    private final SchedulerProperties properties;

    public AutoScheduleService(ScheduleRepository schedules, StaffRepository staff, ShiftRepository shifts,
                               TransactionCountRepository transactions, AssignmentRepository assignments,
                               SchedulerProperties properties) {
        this.schedules = schedules;
        this.staff = staff;
        this.shifts = shifts;
        this.transactions = transactions;
        this.assignments = assignments;
        this.properties = properties;
    }

    /** Drafts a roster and replaces whatever roster the schedule had. */
    public AutoScheduleResponse generate(Long scheduleId) {
        if (!schedules.existsById(scheduleId)) {
            throw new ResourceNotFoundException("Schedule", scheduleId);
        }
        List<StaffDef> team = staff.findAllInSchedule(scheduleId).stream()
                .map(s -> new StaffDef(s.getId(), s.getName(), s.getMaxWeeklyHours())).toList();
        List<ShiftDef> shiftDefs = shifts.findByScheduleIdOrderByStartHourAscEndHourAsc(scheduleId).stream()
                .map(s -> new ShiftDef(s.getId(), s.getStartHour(), s.getEndHour())).toList();
        List<TransactionCell> demand = transactions.findAll(scheduleId);
        if (team.isEmpty()) {
            throw FieldProblemException.unprocessable("staff", "Add at least one staff member before auto-scheduling");
        }
        if (shiftDefs.isEmpty()) {
            throw FieldProblemException.unprocessable("shifts", "Add at least one shift before auto-scheduling");
        }
        if (demand.isEmpty()) {
            throw FieldProblemException.unprocessable("transactions",
                    "Upload transaction data before auto-scheduling");
        }

        Draft draft = AutoScheduler.generate(new ScheduleProblem(shiftDefs, team, demand),
                SchedulerParams.defaults(properties.transactionsPerStaffHour()));

        assignments.deleteAllByScheduleId(scheduleId);
        List<AssignmentResponse> saved = assignments.saveAll(draft.placements().stream()
                        .map(p -> new Assignment(scheduleId, p.day(), p.shiftId(), p.staffId())).toList()).stream()
                .map(a -> new AssignmentResponse(a.getId(), a.getDayOfWeek(), a.getShiftId(), a.getStaffId()))
                .toList();
        return new AutoScheduleResponse(saved, draft.warnings(), draft.stats());
    }
}
