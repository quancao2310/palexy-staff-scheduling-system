package com.palexy.scheduler.autoschedule;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param transactionsPerStaffHour N: transactions one person handles per hour. 16 is the NACS average for
 *                                 convenience stores (State of the Industry Report, 2024 data).
 */
@ConfigurationProperties("app.scheduler")
public record SchedulerProperties(@DefaultValue("16") int transactionsPerStaffHour) {
}
