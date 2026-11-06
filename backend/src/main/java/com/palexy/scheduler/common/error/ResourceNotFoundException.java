package com.palexy.scheduler.common.error;

/** Thrown when a requested resource does not exist; mapped to HTTP 404 by {@link GlobalExceptionHandler}. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String resource, Object id) {
        super("%s %s not found".formatted(resource, id));
    }
}
