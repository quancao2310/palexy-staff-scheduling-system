package com.palexy.scheduler.autoschedule.engine;

public enum WarningType {
    /** An open hour has fewer people than it needs. */
    UNDERSTAFFED,
    /** Transactions exist in an hour that no shift covers; only a new shift can fix that. */
    UNCOVERED_HOUR,
    /** A person got far less work than the team average. */
    UNDER_UTILISED
}
