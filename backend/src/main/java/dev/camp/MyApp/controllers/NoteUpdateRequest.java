package dev.camp.MyApp.controllers;

// Same rule as TodoUpdateRequest: null = unchanged, "" = clear, value = set.
public record NoteUpdateRequest(
        String content,
        String section) {
}