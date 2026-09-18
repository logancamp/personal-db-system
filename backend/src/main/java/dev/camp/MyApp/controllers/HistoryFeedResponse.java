package dev.camp.MyApp.controllers;

import java.time.LocalDateTime;
import java.util.List;

public record HistoryFeedResponse(
        boolean historyEnabled,
        List<FeedRevision> revisions,
        Long nextCursor) {
    public record FeedRevision(
            long revisionId,
            String entityKind,
            long entityId,
            LocalDateTime changedAt,
            String changedBy,
            String changeType,
            Object state) {
    }
}