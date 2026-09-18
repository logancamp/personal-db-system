package dev.camp.MyApp.controllers;

import java.util.Map;

public record MeResponse(
        String username,
        String email,
        Boolean verified,
        String role,
        String llmProvider,
        Map<String, Boolean> llmKeysSet,
        String model,
        String systemPrompt,
        String aiExecutionMode,
        String localLlmAddress,
        boolean autoReplyEnabled,
        String inboxLlmProvider,
        String inboxModel,
        String inboxSystemPrompt,
        boolean historyEnabled,
        Integer historyRetentionDays
) {}