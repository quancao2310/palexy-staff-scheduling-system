package com.palexy.scheduler.roster;

import com.palexy.scheduler.common.error.ResourceNotFoundException;
import com.palexy.scheduler.schedule.ScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class RosterService {

    private final AssignmentRepository assignments;
    private final ScheduleRepository schedules;

    public RosterService(AssignmentRepository assignments, ScheduleRepository schedules) {
        this.assignments = assignments;
        this.schedules = schedules;
    }

    public List<AssignmentResponse> list(Long scheduleId) {
        if (!schedules.existsById(scheduleId)) {
            throw new ResourceNotFoundException("Schedule", scheduleId);
        }
        return assignments.findByScheduleIdOrderByDayOfWeekAscShiftIdAscStaffIdAsc(scheduleId).stream()
                .map(AssignmentResponse::of).toList();
    }
}
