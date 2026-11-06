package com.palexy.scheduler.shift;

import com.palexy.scheduler.common.persistence.ScheduleCount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    List<Shift> findByScheduleIdOrderByStartHourAscEndHourAsc(Long scheduleId);

    Optional<Shift> findByIdAndScheduleId(Long id, Long scheduleId);

    long countByScheduleId(Long scheduleId);

    boolean existsByScheduleIdAndStartHourAndEndHour(Long scheduleId, int startHour, int endHour);

    boolean existsByScheduleIdAndStartHourAndEndHourAndIdNot(Long scheduleId, int startHour, int endHour, Long id);

    @Query("select s.scheduleId as scheduleId, count(s) as total from Shift s group by s.scheduleId")
    List<ScheduleCount> countPerSchedule();
}
