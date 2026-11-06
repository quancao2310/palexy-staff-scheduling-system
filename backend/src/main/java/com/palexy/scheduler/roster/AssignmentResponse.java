package com.palexy.scheduler.roster;

public record AssignmentResponse(Long id, int day, Long shiftId, Long staffId) {

    static AssignmentResponse of(Assignment assignment) {
        return new AssignmentResponse(assignment.getId(), assignment.getDayOfWeek(), assignment.getShiftId(),
                assignment.getStaffId());
    }
}
