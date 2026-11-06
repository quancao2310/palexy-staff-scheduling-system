-- One row = one person working one shift on one day of the week (the roster).
-- day_of_week: 1 = Monday ... 7 = Sunday
CREATE TABLE assignment (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES schedule (id) ON DELETE CASCADE,
    day_of_week INT    NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    shift_id    BIGINT NOT NULL REFERENCES shift (id) ON DELETE CASCADE,
    staff_id    BIGINT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    CONSTRAINT uq_assignment_slot UNIQUE (schedule_id, day_of_week, shift_id, staff_id)
);
CREATE INDEX ix_assignment_staff ON assignment (staff_id);
CREATE INDEX ix_assignment_shift ON assignment (shift_id);
