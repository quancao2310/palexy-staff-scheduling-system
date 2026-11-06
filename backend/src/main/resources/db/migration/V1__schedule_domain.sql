CREATE TABLE schedule (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                     VARCHAR(100) NOT NULL,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    transactions_file_name   VARCHAR(255),
    transactions_uploaded_at TIMESTAMPTZ
);

CREATE TABLE staff (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id      BIGINT       NOT NULL REFERENCES schedule (id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    max_weekly_hours INT          NOT NULL CHECK (max_weekly_hours BETWEEN 1 AND 168)
);
CREATE UNIQUE INDEX uq_staff_schedule_name ON staff (schedule_id, lower(name));

-- end_hour = 24 means midnight
CREATE TABLE shift (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES schedule (id) ON DELETE CASCADE,
    start_hour  INT    NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
    end_hour    INT    NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
    CONSTRAINT ck_shift_order CHECK (end_hour > start_hour),
    CONSTRAINT uq_shift_schedule_times UNIQUE (schedule_id, start_hour, end_hour)
);

-- day_of_week: 1 = Monday ... 7 = Sunday
CREATE TABLE transaction_count (
    schedule_id  BIGINT NOT NULL REFERENCES schedule (id) ON DELETE CASCADE,
    day_of_week  INT    NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    hour         INT    NOT NULL CHECK (hour BETWEEN 0 AND 23),
    transactions INT    NOT NULL CHECK (transactions >= 0),
    PRIMARY KEY (schedule_id, day_of_week, hour)
);
