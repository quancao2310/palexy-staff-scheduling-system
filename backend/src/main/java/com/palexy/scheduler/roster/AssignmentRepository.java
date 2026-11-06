package com.palexy.scheduler.roster;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    List<Assignment> findByScheduleIdOrderByDayOfWeekAscShiftIdAscStaffIdAsc(Long scheduleId);

    /**
     * A bulk delete that runs immediately. Replacing a roster deletes and re-inserts the same
     * (day, shift, staff) rows, and Hibernate would otherwise flush the inserts before the deletes
     * and trip the unique constraint.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from Assignment a where a.scheduleId = :scheduleId")
    void deleteAllByScheduleId(Long scheduleId);
}
