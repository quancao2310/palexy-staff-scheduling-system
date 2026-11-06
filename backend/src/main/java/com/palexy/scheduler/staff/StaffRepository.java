package com.palexy.scheduler.staff;

import com.palexy.scheduler.common.persistence.ScheduleCount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StaffRepository extends JpaRepository<Staff, Long> {

    @Query("select s from Staff s where s.scheduleId = :scheduleId order by lower(s.name), s.id")
    List<Staff> findAllInSchedule(Long scheduleId);

    Optional<Staff> findByIdAndScheduleId(Long id, Long scheduleId);

    long countByScheduleId(Long scheduleId);

    boolean existsByScheduleIdAndNameIgnoreCase(Long scheduleId, String name);

    boolean existsByScheduleIdAndNameIgnoreCaseAndIdNot(Long scheduleId, String name, Long id);

    @Query("select s.scheduleId as scheduleId, count(s) as total from Staff s group by s.scheduleId")
    List<ScheduleCount> countPerSchedule();
}
