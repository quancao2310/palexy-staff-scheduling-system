package com.palexy.scheduler.autoschedule;

import com.palexy.scheduler.autoschedule.engine.Stats;
import com.palexy.scheduler.autoschedule.engine.Warning;
import com.palexy.scheduler.roster.AssignmentResponse;

import java.util.List;

/** The draft: the saved roster plus what the manager should know about it. */
public record AutoScheduleResponse(List<AssignmentResponse> assignments, List<Warning> warnings, Stats stats) {
}
