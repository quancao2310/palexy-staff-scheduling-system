package com.palexy.scheduler.transactions;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Days are matched by name, so column order and the date part of the header do not matter. */
public final class TransactionReportParser {

    private static final char[] DELIMITERS = {',', ';', '\t'};
    private static final int MAX_PROBLEMS = 20;
    private static final long MAX_COUNT = 1_000_000;

    private static final Pattern HOUR = Pattern.compile(
            "^(\\d{1,2})(?::(\\d{2}))?\\s*(?:([ap])\\.?m\\.?)?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLAIN_COUNT = Pattern.compile("^\\d+(\\.0+)?$");
    private static final Pattern GROUPED_COUNT = Pattern.compile("^\\d{1,3}(,\\d{3})+$");
    private static final Pattern TOTAL_LABEL = Pattern.compile("^(grand\\s+)?(total|totals|sum)$",
            Pattern.CASE_INSENSITIVE);

    private TransactionReportParser() {
    }

    public static ParsedReport parse(byte[] content) {
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(content))
                    .toString();
            return parse(text);
        } catch (CharacterCodingException e) {
            throw new ReportFormatException("The file isn't UTF-8 text. Export the report as a plain CSV and try again.");
        }
    }

    public static ParsedReport parse(String text) {
        if (!text.isEmpty() && text.charAt(0) == '﻿') {
            text = text.substring(1);
        }
        if (text.isBlank()) {
            throw new ReportFormatException("The file is empty.");
        }
        String[] lines = text.split("\r\n|\n|\r", -1);

        for (char delimiter : DELIMITERS) {
            List<List<String>> rows = new ArrayList<>(lines.length);
            for (String line : lines) {
                rows.add(splitLine(line, delimiter));
            }
            int headerIndex = findHeader(rows);
            if (headerIndex >= 0) {
                return readRows(rows, headerIndex);
            }
        }
        throw new ReportFormatException(
                "Couldn't find a header row with weekday names (Mon, Tue, … or Monday, Tuesday, …).");
    }

    private static int findHeader(List<List<String>> rows) {
        int best = -1;
        int bestCount = 0;
        for (int i = 0; i < rows.size(); i++) {
            int count = (int) rows.get(i).stream().filter(c -> weekday(c).isPresent()).count();
            if (count > bestCount) {
                best = i;
                bestCount = count;
            }
        }
        return best;
    }

    private static ParsedReport readRows(List<List<String>> rows, int headerIndex) {
        List<String> problems = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        Map<Integer, DayOfWeek> dayColumns = new LinkedHashMap<>();
        EnumMap<DayOfWeek, Integer> columnOfDay = new EnumMap<>(DayOfWeek.class);
        List<String> header = rows.get(headerIndex);
        int headerLine = headerIndex + 1;
        for (int col = 0; col < header.size(); col++) {
            String cell = header.get(col).strip();
            Optional<DayOfWeek> day = weekday(cell);
            if (day.isPresent()) {
                if (columnOfDay.containsKey(day.get())) {
                    problems.add("Line %d: %s appears in more than one column.".formatted(headerLine, name(day.get())));
                } else {
                    columnOfDay.put(day.get(), col);
                    dayColumns.put(col, day.get());
                }
            } else if (col > 0 && !cell.isEmpty()) {
                warnings.add("Column \"%s\" isn't a weekday, so it was ignored.".formatted(cell));
            }
        }
        if (dayColumns.containsKey(0)) {
            problems.add("Line %d: the first column must hold the hour of day (e.g. 7am), not a weekday."
                    .formatted(headerLine));
        }

        Map<Integer, Integer> lineOfHour = new LinkedHashMap<>();
        Map<Integer, Map<DayOfWeek, Integer>> counts = new LinkedHashMap<>();
        int emptyCells = 0;
        for (int i = headerIndex + 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int line = i + 1;
            if (row.stream().allMatch(c -> c.isBlank())) {
                continue;
            }
            String label = row.get(0).strip();
            if (TOTAL_LABEL.matcher(label).matches()) {
                warnings.add("Skipped the \"%s\" row on line %d.".formatted(label, line));
                continue;
            }
            int hour;
            try {
                hour = parseHour(label);
            } catch (IllegalArgumentException e) {
                problems.add("Line %d: %s".formatted(line, e.getMessage()));
                continue;
            }
            Integer firstLine = lineOfHour.putIfAbsent(hour, line);
            if (firstLine != null) {
                problems.add("Line %d: the hour \"%s\" is already listed on line %d.".formatted(line, label, firstLine));
                continue;
            }
            Map<DayOfWeek, Integer> perDay = new EnumMap<>(DayOfWeek.class);
            for (Map.Entry<Integer, DayOfWeek> column : dayColumns.entrySet()) {
                String raw = column.getKey() < row.size() ? row.get(column.getKey()).strip() : "";
                if (raw.isEmpty()) {
                    emptyCells++;
                    perDay.put(column.getValue(), 0);
                    continue;
                }
                long count = parseCount(raw);
                if (count == INVALID) {
                    problems.add("Line %d, %s: \"%s\" isn't a whole number from 0 to %,d."
                            .formatted(line, name(column.getValue()), raw, MAX_COUNT));
                } else {
                    perDay.put(column.getValue(), (int) count);
                }
            }
            counts.put(hour, perDay);
        }

        if (counts.isEmpty() && problems.isEmpty()) {
            problems.add("No hourly rows found below the header on line %d.".formatted(headerLine));
        }
        if (!problems.isEmpty()) {
            throw new ReportFormatException(capped(problems));
        }

        List<String> missingDays = new ArrayList<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            if (!columnOfDay.containsKey(day)) {
                missingDays.add(name(day));
            }
        }
        if (!missingDays.isEmpty()) {
            warnings.add("No column for %s, so %s treated as 0 transactions."
                    .formatted(String.join(", ", missingDays), missingDays.size() == 1 ? "it is" : "they are"));
        }
        if (emptyCells > 0) {
            warnings.add("%d empty %s treated as 0.".formatted(emptyCells, emptyCells == 1 ? "cell was" : "cells were"));
        }

        List<TransactionCell> cells = new ArrayList<>();
        counts.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(hourEntry ->
                hourEntry.getValue().forEach((day, value) ->
                        cells.add(new TransactionCell(day.getValue(), hourEntry.getKey(), value))));
        cells.sort((a, b) -> a.day() != b.day() ? Integer.compare(a.day(), b.day()) : Integer.compare(a.hour(), b.hour()));
        return new ParsedReport(List.copyOf(cells), List.copyOf(warnings));
    }

    static Optional<DayOfWeek> weekday(String cell) {
        String text = cell.strip().toLowerCase(Locale.ROOT);
        int end = 0;
        while (end < text.length() && Character.isLetter(text.charAt(end))) {
            end++;
        }
        String token = text.substring(0, end);
        if (token.length() < 3) {
            return Optional.empty();
        }
        for (DayOfWeek day : DayOfWeek.values()) {
            if (day.name().toLowerCase(Locale.ROOT).startsWith(token)) {
                return Optional.of(day);
            }
        }
        return Optional.empty();
    }

    static int parseHour(String label) {
        if (label.isEmpty()) {
            throw new IllegalArgumentException("the hour in the first column is empty.");
        }
        Matcher m = HOUR.matcher(label);
        String expected = "Use a label like 7am, 12pm, 07:00 or 13.";
        if (!m.matches()) {
            throw new IllegalArgumentException("couldn't read the hour \"%s\". %s".formatted(label, expected));
        }
        int hour = Integer.parseInt(m.group(1));
        String minutes = m.group(2);
        if (minutes != null && !minutes.equals("00")) {
            throw new IllegalArgumentException(
                    "\"%s\" isn't a whole hour; only hourly rows are supported.".formatted(label));
        }
        String meridiem = m.group(3);
        if (meridiem != null) {
            if (hour < 1 || hour > 12) {
                throw new IllegalArgumentException("couldn't read the hour \"%s\". %s".formatted(label, expected));
            }
            boolean pm = meridiem.equalsIgnoreCase("p");
            return (hour % 12) + (pm ? 12 : 0);
        }
        if (hour > 23) {
            throw new IllegalArgumentException("couldn't read the hour \"%s\". %s".formatted(label, expected));
        }
        return hour;
    }

    private static final long INVALID = -1;

    private static long parseCount(String raw) {
        String text = raw.replace(" ", "");
        if (GROUPED_COUNT.matcher(text).matches()) {
            text = text.replace(",", "");
        }
        if (!PLAIN_COUNT.matcher(text).matches()) {
            return INVALID;
        }
        int dot = text.indexOf('.');
        String digits = dot >= 0 ? text.substring(0, dot) : text;
        if (digits.length() > 7) {
            return INVALID;
        }
        long value = Long.parseLong(digits);
        return value > MAX_COUNT ? INVALID : value;
    }

    static List<String> splitLine(String line, char delimiter) {
        List<String> cells = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        current.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    current.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == delimiter) {
                cells.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        cells.add(current.toString());
        return cells;
    }

    private static List<String> capped(List<String> problems) {
        if (problems.size() <= MAX_PROBLEMS) {
            return problems;
        }
        List<String> shown = new ArrayList<>(problems.subList(0, MAX_PROBLEMS));
        shown.add("…and %d more.".formatted(problems.size() - MAX_PROBLEMS));
        return shown;
    }

    private static String name(DayOfWeek day) {
        String lower = day.name().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
