package com.palexy.scheduler.transactions;

import java.util.List;

public record ParsedReport(List<TransactionCell> cells, List<String> warnings) {
}
