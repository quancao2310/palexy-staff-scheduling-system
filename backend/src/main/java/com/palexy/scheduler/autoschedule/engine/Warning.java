package com.palexy.scheduler.autoschedule.engine;

/** A problem with the draft. Fields that do not apply to a type are null; {@code message} is ready to show. */
public record Warning(WarningType type, Integer day, Integer hour, Long staffId, Integer needed, Integer scheduled,
                      String message) {
}
