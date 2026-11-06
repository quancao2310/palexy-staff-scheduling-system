package com.palexy.scheduler.schedule;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ScheduleRequest(
        @NotBlank(message = "Enter a name") @Size(max = 100, message = "Use at most 100 characters") String name) {
}
