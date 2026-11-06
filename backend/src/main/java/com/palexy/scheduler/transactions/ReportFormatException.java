package com.palexy.scheduler.transactions;

import java.util.List;

public class ReportFormatException extends RuntimeException {

    private final List<String> problems;

    public ReportFormatException(List<String> problems) {
        super("The file couldn't be imported");
        this.problems = List.copyOf(problems);
    }

    public ReportFormatException(String problem) {
        this(List.of(problem));
    }

    public List<String> problems() {
        return problems;
    }
}
