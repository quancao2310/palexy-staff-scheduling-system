package com.palexy.scheduler.demo;

import com.palexy.scheduler.schedule.ScheduleRepository;
import com.palexy.scheduler.schedule.ScheduleRequest;
import com.palexy.scheduler.schedule.ScheduleResponse;
import com.palexy.scheduler.schedule.ScheduleService;
import com.palexy.scheduler.staff.StaffRequest;
import com.palexy.scheduler.staff.StaffService;
import com.palexy.scheduler.transactions.TransactionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true", matchIfMissing = true)
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final String REPORT = "demo/sample_transaction_interview.csv";

    private final ScheduleRepository schedules;
    private final ScheduleService scheduleService;
    private final StaffService staffService;
    private final TransactionService transactionService;

    public DemoDataSeeder(ScheduleRepository schedules, ScheduleService scheduleService, StaffService staffService,
                          TransactionService transactionService) {
        this.schedules = schedules;
        this.scheduleService = scheduleService;
        this.staffService = staffService;
        this.transactionService = transactionService;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (schedules.count() > 0) {
            return;
        }
        ScheduleResponse schedule = scheduleService.create(new ScheduleRequest("Downtown store (sample)"));
        team().forEach((name, hours) -> staffService.create(schedule.id(), new StaffRequest(name, hours)));
        transactionService.replace(schedule.id(), "sample_transaction_interview.csv",
                new ClassPathResource(REPORT).getContentAsByteArray());
        log.info("Seeded sample schedule {} with {} staff", schedule.id(), team().size());
    }

    private static Map<String, Integer> team() {
        Map<String, Integer> team = new LinkedHashMap<>();
        team.put("Anna Nguyen", 40);
        team.put("Ben Tran", 40);
        team.put("Chloe Le", 32);
        team.put("David Pham", 32);
        team.put("Emma Vo", 24);
        team.put("Felix Hoang", 24);
        team.put("Grace Dang", 20);
        team.put("Henry Bui", 20);
        team.put("Ivy Do", 16);
        team.put("Jack Ly", 12);
        return team;
    }
}
