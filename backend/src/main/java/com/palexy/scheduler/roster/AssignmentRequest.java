package com.palexy.scheduler.roster;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Puts one person on one shift on one day ({@code day}: 1 = Monday ... 7 = Sunday). */
public record AssignmentRequest(
        @NotNull(message = "Choose a day")
        @Min(value = 1, message = "Day must be between 1 (Monday) and 7 (Sunday)")
        @Max(value = 7, message = "Day must be between 1 (Monday) and 7 (Sunday)") Integer day,
        @NotNull(message = "Choose a shift") Long shiftId,
        @NotNull(message = "Choose a person") Long staffId) {
}
