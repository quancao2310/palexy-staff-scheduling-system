package com.palexy.scheduler.autoschedule.engine;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ShiftDefTest {

    @Test
    void aShiftEndingAtMidnightCoversTheLastHour() {
        ShiftDef evening = new ShiftDef(1, 15, 24);

        assertThat(evening.covers(23)).isTrue();
        assertThat(evening.covers(14)).isFalse();
        assertThat(evening.length()).isEqualTo(9);
    }

    @Test
    void shiftsThatOnlyTouchDoNotOverlap() {
        ShiftDef morning = new ShiftDef(1, 7, 15);

        assertThat(morning.overlaps(new ShiftDef(2, 11, 15))).isTrue();
        assertThat(morning.overlaps(new ShiftDef(3, 15, 23))).isFalse();
    }
}
