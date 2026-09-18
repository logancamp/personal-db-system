package dev.camp.MyApp.controllers;

// null = unchanged, "" = clear, value = set. Dates are strings so parsing follows the same rule.
public record TodoUpdateRequest(
        String title,
        Boolean completed,
        String notes,
        String section,
        String dueAt,
        String todoDate,
        Integer sortOrder) {
}