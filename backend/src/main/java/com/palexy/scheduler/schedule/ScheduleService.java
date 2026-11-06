package com.palexy.scheduler.schedule;

import com.palexy.scheduler.common.error.ResourceNotFoundException;
import com.palexy.scheduler.common.persistence.ScheduleCount;
import com.palexy.scheduler.shift.Shift;
import com.palexy.scheduler.shift.ShiftRepository;
import com.palexy.scheduler.staff.StaffRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class ScheduleService {

    private static final int[][] DEFAULT_SHIFTS = {{7, 15}, {15, 23}};

    private final ScheduleRepository schedules;
    private final StaffRepository staff;
    private final ShiftRepository shifts;

    public ScheduleService(ScheduleRepository schedules, StaffRepository staff, ShiftRepository shifts) {
        this.schedules = schedules;
        this.staff = staff;
        this.shifts = shifts;
    }

    @Transactional(readOnly = true)
    public List<ScheduleResponse> list() {
        Map<Long, Long> staffCounts = toMap(staff.countPerSchedule());
        Map<Long, Long> shiftCounts = toMap(shifts.countPerSchedule());
        return schedules.findAllByOrderByCreatedAtDescIdDesc().stream()
                .map(s -> ScheduleResponse.of(s, staffCounts.getOrDefault(s.getId(), 0L),
                        shiftCounts.getOrDefault(s.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public ScheduleResponse get(Long id) {
        return toResponse(find(id));
    }

    public ScheduleResponse create(ScheduleRequest request) {
        Schedule schedule = schedules.save(new Schedule(request.name().strip()));
        for (int[] times : DEFAULT_SHIFTS) {
            shifts.save(new Shift(schedule.getId(), times[0], times[1]));
        }
        return toResponse(schedule);
    }

    public ScheduleResponse rename(Long id, ScheduleRequest request) {
        Schedule schedule = find(id);
        schedule.rename(request.name().strip());
        return toResponse(schedules.save(schedule));
    }

    public void delete(Long id) {
        schedules.delete(find(id));
    }

    private ScheduleResponse toResponse(Schedule schedule) {
        return ScheduleResponse.of(schedule, staff.countByScheduleId(schedule.getId()),
                shifts.countByScheduleId(schedule.getId()));
    }

    private Schedule find(Long id) {
        return schedules.findById(id).orElseThrow(() -> new ResourceNotFoundException("Schedule", id));
    }

    private static Map<Long, Long> toMap(List<ScheduleCount> counts) {
        return counts.stream().collect(Collectors.toMap(ScheduleCount::getScheduleId, ScheduleCount::getTotal));
    }
}
