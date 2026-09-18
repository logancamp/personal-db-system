package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.MessageTarget;

import java.time.LocalDateTime;
import java.util.List;

public record UnreadSummary(long total, List<ConversationUnread> conversations) {
    public record ConversationUnread(
            String username,
            MessageTarget target,
            long count,
            LocalDateTime latestAt) {
    }
}