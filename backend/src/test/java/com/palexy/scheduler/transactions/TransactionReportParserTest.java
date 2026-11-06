package com.palexy.scheduler.transactions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TransactionReportParserTest {

    private static final int MONDAY = 1;
    private static final int FRIDAY = 5;

    @Test
    void parsesTheProvidedSampleFile() throws IOException {
        byte[] sample = Files.readAllBytes(Path.of("..", "sample-data", "sample_transaction_interview.csv"));

        ParsedReport report = TransactionReportParser.parse(sample);

        assertThat(report.cells()).hasSize(16 * 7);
        assertThat(report.warnings()).isEmpty();
        assertThat(count(report, FRIDAY, 7)).isEqualTo(22);
        assertThat(count(report, MONDAY, 7)).isEqualTo(12);
        assertThat(count(report, 4, 22)).isEqualTo(6);
        assertThat(count(report, MONDAY, 13)).isEqualTo(45);
    }

    @Test
    void matchesDaysByNameRegardlessOfOrderAndStripsBomAndCrlf() {
        String csv = "﻿\"Some title\"\r\n,Tue,\"Mon, 10 Aug\"\r\n7am,5,9\r\n8am,6,10\r\n";

        ParsedReport report = TransactionReportParser.parse(csv);

        assertThat(count(report, MONDAY, 7)).isEqualTo(9);
        assertThat(count(report, 2, 8)).isEqualTo(6);
    }

    @Test
    void reportsMissingDaysAndEmptyCellsAsWarnings() {
        ParsedReport report = TransactionReportParser.parse("hour,Mon,Tue\n7am,1,\n8am,2,3\n");

        assertThat(count(report, 2, 7)).isZero();
        assertThat(report.warnings()).anyMatch(w -> w.contains("Wednesday") && w.contains("Sunday"));
        assertThat(report.warnings()).anyMatch(w -> w.contains("1 empty cell"));
    }

    @Test
    void skipsTotalRowAndUnknownColumnsWithWarnings() {
        ParsedReport report = TransactionReportParser.parse("hour,Mon,Total\n7am,4,4\nTotal,4,4\n");

        assertThat(report.cells()).containsExactly(new TransactionCell(MONDAY, 7, 4));
        assertThat(report.warnings()).anyMatch(w -> w.contains("\"Total\"") && w.contains("ignored"));
        assertThat(report.warnings()).anyMatch(w -> w.contains("Skipped"));
    }

    @Test
    void acceptsSemicolonDelimiter() {
        ParsedReport report = TransactionReportParser.parse("hour;Mon\n7am;3\n");

        assertThat(count(report, MONDAY, 7)).isEqualTo(3);
    }

    @ParameterizedTest
    @CsvSource({"7am,7", "12am,0", "12pm,12", "1pm,13", "10pm,22", "07:00,7", "13,13", "7 AM,7", "7:00pm,19"})
    void parsesHourLabels(String label, int expected) {
        assertThat(TransactionReportParser.parseHour(label)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"0am", "13pm", "25", "7:30am", "noon", "abc"})
    void rejectsUnreadableHourLabels(String label) {
        assertThatThrownBy(() -> TransactionReportParser.parseHour(label)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBadCountsWithLineNumbers() {
        String csv = "hour,Mon,Tue\n7am,1,-2\n8am,x,3\n";

        assertThatThrownBy(() -> TransactionReportParser.parse(csv))
                .isInstanceOfSatisfying(ReportFormatException.class, e -> assertThat(e.problems())
                        .anyMatch(p -> p.startsWith("Line 2, Tuesday") && p.contains("-2"))
                        .anyMatch(p -> p.startsWith("Line 3, Monday") && p.contains("\"x\"")));
    }

    @Test
    void rejectsDuplicateHoursAndDuplicateDays() {
        assertThatThrownBy(() -> TransactionReportParser.parse("hour,Mon\n7am,1\n7,2\n"))
                .isInstanceOfSatisfying(ReportFormatException.class, e -> assertThat(e.problems())
                        .singleElement().asString().contains("Line 3").contains("line 2"));

        assertThatThrownBy(() -> TransactionReportParser.parse("hour,Mon,Monday\n7am,1,2\n"))
                .isInstanceOfSatisfying(ReportFormatException.class, e -> assertThat(e.problems())
                        .singleElement().asString().contains("Monday"));
    }

    @Test
    void rejectsFilesWithoutAWeekdayHeaderOrWithoutRows() {
        assertThatThrownBy(() -> TransactionReportParser.parse("hour,a,b\n7am,1,2\n"))
                .isInstanceOf(ReportFormatException.class);
        assertThatThrownBy(() -> TransactionReportParser.parse("hour,Mon\n"))
                .isInstanceOf(ReportFormatException.class);
        assertThatThrownBy(() -> TransactionReportParser.parse("  \n")).isInstanceOf(ReportFormatException.class);
        assertThatThrownBy(() -> TransactionReportParser.parse(new byte[]{(byte) 0xFF, (byte) 0xFE, 0x41}))
                .isInstanceOf(ReportFormatException.class);
    }

    @Test
    void capsTheNumberOfReportedProblems() {
        StringBuilder csv = new StringBuilder("hour,Mon\n");
        for (int i = 0; i < 30; i++) {
            csv.append("bad").append(i).append(",1\n");
        }

        assertThatThrownBy(() -> TransactionReportParser.parse(csv.toString()))
                .isInstanceOfSatisfying(ReportFormatException.class, e -> {
                    assertThat(e.problems()).hasSize(21);
                    assertThat(e.problems().getLast()).contains("10 more");
                });
    }

    @Test
    void splitsQuotedCellsContainingTheDelimiter() {
        assertThat(TransactionReportParser.splitLine(",\"Fri, 07 Aug\",\"a \"\"b\"\"\"", ','))
                .isEqualTo(List.of("", "Fri, 07 Aug", "a \"b\""));
    }

    private static int count(ParsedReport report, int day, int hour) {
        return report.cells().stream()
                .filter(c -> c.day() == day && c.hour() == hour)
                .findFirst()
                .map(TransactionCell::transactions)
                .orElse(0);
    }
}
