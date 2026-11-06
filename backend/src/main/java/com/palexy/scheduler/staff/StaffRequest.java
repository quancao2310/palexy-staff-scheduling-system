package com.palexy.scheduler.staff;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StaffRequest(
        @NotBlank(message = "Enter a name") @Size(max = 100, message = "Use at most 100 characters") String name,
        @NotNull(message = "Enter the maximum weekly hours")
        @Min(value = 1, message = "Must be at least 1 hour")
        @Max(value = 168, message = "A week has only 168 hours") Integer maxWeeklyHours) {
}
