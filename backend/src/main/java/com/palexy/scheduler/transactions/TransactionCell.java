package com.palexy.scheduler.transactions;

/** {@code day} is ISO (1 = Monday ... 7 = Sunday); {@code hour} is the start of the clock hour (7 = 07:00-08:00). */
public record TransactionCell(int day, int hour, int transactions) {
}
