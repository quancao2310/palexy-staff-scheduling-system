package com.palexy.scheduler.autoschedule.engine;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class NeedTest {

    @ParameterizedTest(name = "{0} transactions need {1} people")
    @CsvSource({"0,1", "6,1", "21,1", "22,2", "38,3", "64,4", "70,5"})
    void oneFullPersonPerNPlusOneWhenTheLeftoverKeepsThemAThirdBusy(int transactions, int expected) {
        assertThat(Need.of(transactions, Fixtures.PARAMS)).isEqualTo(expected);
    }
}
