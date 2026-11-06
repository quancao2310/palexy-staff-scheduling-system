package com.palexy.scheduler.autoschedule.engine;

import java.util.List;

public record Draft(List<Placement> placements, List<Warning> warnings, Stats stats) {
}
