package com.palexy.scheduler.shift;

import com.palexy.scheduler.common.error.FieldProblemException;
import com.palexy.scheduler.common.error.ResourceNotFoundException;
import com.palexy.scheduler.schedule.ScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ShiftService {

    private static final String DUPLICATE = "A shift with these times already exists";

    private final ShiftRepository shiftRepository;
    private final ScheduleRepository scheduleRepository;

    public ShiftService(ShiftRepository shiftRepository, ScheduleRepository scheduleRepository) {
        this.shiftRepository = shiftRepository;
        this.scheduleRepository = scheduleRepository;
    }

    @Transactional(readOnly = true)
    public List<ShiftResponse> list(Long scheduleId) {
        requireSchedule(scheduleId);
        return shiftRepository.findByScheduleIdOrderByStartHourAscEndHourAsc(scheduleId).stream()
                .map(ShiftResponse::of).toList();
    }

    public ShiftResponse create(Long scheduleId, ShiftRequest request) {
        requireSchedule(scheduleId);
        validate(request);
        if (shiftRepository.existsByScheduleIdAndStartHourAndEndHour(
                scheduleId, request.startHour(), request.endHour())) {
            throw FieldProblemException.conflict("endHour", DUPLICATE);
        }
        return ShiftResponse.of(shiftRepository.saveAndFlush(
                new Shift(scheduleId, request.startHour(), request.endHour())));
    }

    public ShiftResponse update(Long scheduleId, Long shiftId, ShiftRequest request) {
        Shift shift = find(scheduleId, shiftId);
        validate(request);
        if (shiftRepository.existsByScheduleIdAndStartHourAndEndHourAndIdNot(
                scheduleId, request.startHour(), request.endHour(), shiftId)) {
            throw FieldProblemException.conflict("endHour", DUPLICATE);
        }
        shift.reschedule(request.startHour(), request.endHour());
        return ShiftResponse.of(shiftRepository.saveAndFlush(shift));
    }

    public void delete(Long scheduleId, Long shiftId) {
        shiftRepository.delete(find(scheduleId, shiftId));
    }

    private static void validate(ShiftRequest request) {
        if (request.endHour() <= request.startHour()) {
            throw FieldProblemException.invalid("endHour", "End time must be after the start time");
        }
    }

    private Shift find(Long scheduleId, Long shiftId) {
        return shiftRepository.findByIdAndScheduleId(shiftId, scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Shift", shiftId));
    }

    private void requireSchedule(Long scheduleId) {
        if (!scheduleRepository.existsById(scheduleId)) {
            throw new ResourceNotFoundException("Schedule", scheduleId);
        }
    }
}
