package com.palexy.scheduler.transactions;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class TransactionCountRepository {

    private final JdbcTemplate jdbc;

    public TransactionCountRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<TransactionCell> findAll(Long scheduleId) {
        return jdbc.query(
                "select day_of_week, hour, transactions from transaction_count "
                        + "where schedule_id = ? order by day_of_week, hour",
                (rs, row) -> new TransactionCell(rs.getInt("day_of_week"), rs.getInt("hour"), rs.getInt("transactions")),
                scheduleId);
    }

    public void deleteAll(Long scheduleId) {
        jdbc.update("delete from transaction_count where schedule_id = ?", scheduleId);
    }

    public void insertAll(Long scheduleId, List<TransactionCell> cells) {
        jdbc.batchUpdate(
                "insert into transaction_count (schedule_id, day_of_week, hour, transactions) values (?, ?, ?, ?)",
                cells, 100, (ps, cell) -> {
                    ps.setLong(1, scheduleId);
                    ps.setInt(2, cell.day());
                    ps.setInt(3, cell.hour());
                    ps.setInt(4, cell.transactions());
                });
    }
}
