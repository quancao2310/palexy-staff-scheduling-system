package com.palexy.scheduler.transactions;

import java.time.Instant;
import java.util.List;

public record TransactionsResponse(
        boolean hasData,
        String fileName,
        Instant uploadedAt,
        List<TransactionCell> cells,
        long total,
        TransactionCell peak,
        List<String> warnings) {
}
