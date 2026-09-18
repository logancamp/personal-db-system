package dev.camp.MyApp.controllers.tools;

import dev.camp.MyApp.controllers.NoteUpdateRequest;
import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.services.NotesService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class NoteTools {
    private final NotesService notesService;
    private final CurrentUser currentUser;

    public NoteTools(NotesService notesService, CurrentUser currentUser) {
        this.notesService = notesService;
        this.currentUser = currentUser;
    }

    @Tool(name = "list_notes", description = "List the user's notes. Pass an empty string for section to list all of them.")
    public List<Note> listNotes(
            @ToolParam(description = "Only return notes in this section. Empty string means all sections.", required = true)
            String section) {
        List<Note> all = notesService.findAllForUser(currentUser.username());
        if (TodoTools.isBlank(section)) {
            return all;
        }
        return all.stream().filter(n -> section.equalsIgnoreCase(n.section)).toList();
    }

    @Tool(name = "add_note", description = "Save a new note. If this returns DUPLICATE, tell the user what already exists and ask whether they want it saved anyway.")
    public String addNote(
            @ToolParam(description = "The note content", required = true) String content) {
        Note similar = findSimilar(content);
        if (similar != null) {
            return "DUPLICATE: a similar note already exists -- [" + similar.id + "] \""
                    + preview(similar.content) + "\". Tell the user this and ask whether they "
                    + "want it saved anyway, or whether they meant to update the existing one. "
                    + "Only if they confirm, call add_duplicate_note.";
        }
        return save(content);
    }

    @Tool(name = "add_duplicate_note", description = "Save a note even though a similar one already exists. ONLY call this after the user has explicitly confirmed they want a duplicate. Never call it as a first attempt -- use add_note.")
    public String addDuplicateNote(
            @ToolParam(description = "The note content", required = true) String content) {
        return save(content);
    }

    @Tool(name = "update_note", description = "Change an existing note. Pass an empty string for any field you are NOT changing.")
    public String updateNote(
            @ToolParam(description = "The id of the note", required = true) Long id,
            @ToolParam(description = "New content, or empty string to leave unchanged", required = true) String content,
            @ToolParam(description = "New section, or empty string to leave unchanged", required = true) String section) {
        Note saved = notesService.update(id, new NoteUpdateRequest(
                TodoTools.blankToNull(content), TodoTools.blankToNull(section)), currentUser.id());
        ActionLog.record("updated note " + saved.id);
        return "Updated note " + saved.id;
    }

    @Tool(name = "delete_note", description = "Permanently delete a note.")
    public String deleteNote(
            @ToolParam(description = "The id of the note", required = true) Long id) {
        notesService.delete(id, currentUser.id());
        ActionLog.record("deleted note " + id);
        return "Deleted note " + id;
    }

    private Note findSimilar(String content) {
        for (Note existing : notesService.findAllForUser(currentUser.username())) {
            if (ItemSimilarity.looksLikeDuplicate(content, existing.content)) {
                return existing;
            }
        }
        return null;
    }

    private String save(String content) {
        Note note = new Note();
        note.content = content;
        Note saved = notesService.create(note, currentUser.id(), CreationSource.WEB, null);
        ActionLog.record("saved a note");
        return "Saved note " + saved.id;
    }

    private static String preview(String s) {
        if (s == null) return "";
        return s.length() <= 60 ? s : s.substring(0, 60) + "...";
    }
}