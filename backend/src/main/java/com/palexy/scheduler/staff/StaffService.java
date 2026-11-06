package com.palexy.scheduler.staff;

import com.palexy.scheduler.common.error.FieldProblemException;
import com.palexy.scheduler.common.error.ResourceNotFoundException;
import com.palexy.scheduler.schedule.ScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class StaffService {

    private static final String DUPLICATE_NAME = "Someone with this name is already on the team";

    private final StaffRepository staffRepository;
    private final ScheduleRepository scheduleRepository;

    public StaffService(StaffRepository staffRepository, ScheduleRepository scheduleRepository) {
        this.staffRepository = staffRepository;
        this.scheduleRepository = scheduleRepository;
    }

    @Transactional(readOnly = true)
    public List<StaffResponse> list(Long scheduleId) {
        requireSchedule(scheduleId);
        return staffRepository.findAllInSchedule(scheduleId).stream().map(StaffResponse::of).toList();
    }

    public StaffResponse create(Long scheduleId, StaffRequest request) {
        requireSchedule(scheduleId);
        String name = request.name().strip();
        if (staffRepository.existsByScheduleIdAndNameIgnoreCase(scheduleId, name)) {
            throw FieldProblemException.conflict("name", DUPLICATE_NAME);
        }
        return StaffResponse.of(staffRepository.saveAndFlush(new Staff(scheduleId, name, request.maxWeeklyHours())));
    }

    public StaffResponse update(Long scheduleId, Long staffId, StaffRequest request) {
        Staff staff = find(scheduleId, staffId);
        String name = request.name().strip();
        if (staffRepository.existsByScheduleIdAndNameIgnoreCaseAndIdNot(scheduleId, name, staffId)) {
            throw FieldProblemException.conflict("name", DUPLICATE_NAME);
        }
        staff.update(name, request.maxWeeklyHours());
        return StaffResponse.of(staffRepository.saveAndFlush(staff));
    }

    public void delete(Long scheduleId, Long staffId) {
        staffRepository.delete(find(scheduleId, staffId));
    }

    private Staff find(Long scheduleId, Long staffId) {
        return staffRepository.findByIdAndScheduleId(staffId, scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member", staffId));
    }

    private void requireSchedule(Long scheduleId) {
        if (!scheduleRepository.existsById(scheduleId)) {
            throw new ResourceNotFoundException("Schedule", scheduleId);
        }
    }
}
