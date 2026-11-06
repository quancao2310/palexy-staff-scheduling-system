package com.palexy.scheduler.common.error;

import org.springframework.http.HttpStatus;

public class FieldProblemException extends RuntimeException {

    private final HttpStatus status;
    private final String field;

    private FieldProblemException(HttpStatus status, String field, String message) {
        super(message);
        this.status = status;
        this.field = field;
    }

    public static FieldProblemException conflict(String field, String message) {
        return new FieldProblemException(HttpStatus.CONFLICT, field, message);
    }

    public static FieldProblemException invalid(String field, String message) {
        return new FieldProblemException(HttpStatus.BAD_REQUEST, field, message);
    }

    /** The request is fine but the schedule is not ready for it (422), e.g. nothing to schedule yet. */
    public static FieldProblemException unprocessable(String field, String message) {
        return new FieldProblemException(HttpStatus.valueOf(422), field, message);
    }

    public HttpStatus status() {
        return status;
    }

    public String field() {
        return field;
    }
}
