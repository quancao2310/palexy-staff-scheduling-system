package com.palexy.scheduler.shift;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ShiftRequest(
        @NotNull(message = "Choose a start time")
        @Min(value = 0, message = "Start must be between 00:00 and 23:00")
        @Max(value = 23, message = "Start must be between 00:00 and 23:00") Integer startHour,
        @NotNull(message = "Choose an end time")
        @Min(value = 1, message = "End must be between 01:00 and 24:00")
        @Max(value = 24, message = "End must be between 01:00 and 24:00") Integer endHour) {
}
