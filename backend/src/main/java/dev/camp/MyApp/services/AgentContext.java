package dev.camp.MyApp.services;

import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.models.types.Todo;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AgentContext {
    private static final int MAX_ITEMS_PER_KIND = 40;
    private static final int NOTE_PREVIEW_CHARS = 80;

    private static final String TURN_SCOPE_RULE = """
            Only act on the user's most recent message. Anything requested in earlier \
            messages has already been carried out -- never repeat it. Before creating a \
            todo or note, check the items listed above: if one already covers what is \
            being asked for, say so rather than creating a near-duplicate under a \
            slightly different name. Use the ids above directly when updating, \
            completing, or deleting something; you do not need to list items first.""";

    private final TodosService todosService;
    private final NotesService notesService;

    public AgentContext(TodosService todosService, NotesService notesService) {
        this.todosService = todosService;
        this.notesService = notesService;
    }

    public String promptSuffix(String username) {
        return currentStateBlock(username) + "\n\n" + TURN_SCOPE_RULE;
    }

    private String currentStateBlock(String username) {
        StringBuilder sb = new StringBuilder(
                "The user's saved items as of right now. These already exist -- do not re-create them.\n\nTodos:");

        List<Todo> todos = todosService.findAllForUser(username);
        if (todos.isEmpty()) {
            sb.append(" (none)");
        } else {
            todos.stream().limit(MAX_ITEMS_PER_KIND).forEach(t -> sb
                    .append("\n  [").append(t.id).append("] ").append(t.title)
                    .append(Boolean.TRUE.equals(t.completed) ? " (done)" : "")
                    .append(t.section == null ? "" : " {" + t.section + "}"));
            if (todos.size() > MAX_ITEMS_PER_KIND) {
                sb.append("\n  ...and ").append(todos.size() - MAX_ITEMS_PER_KIND).append(" more");
            }
        }

        sb.append("\n\nNotes:");
        List<Note> notes = notesService.findAllForUser(username);
        if (notes.isEmpty()) {
            sb.append(" (none)");
        } else {
            notes.stream().limit(MAX_ITEMS_PER_KIND).forEach(n -> sb
                    .append("\n  [").append(n.id).append("] ").append(truncate(n.content))
                    .append(n.section == null ? "" : " {" + n.section + "}"));
            if (notes.size() > MAX_ITEMS_PER_KIND) {
                sb.append("\n  ...and ").append(notes.size() - MAX_ITEMS_PER_KIND).append(" more");
            }
        }

        return sb.toString();
    }

    private static String truncate(String s) {
        if (s == null) {
            return "";
        }
        return s.length() <= NOTE_PREVIEW_CHARS ? s : s.substring(0, NOTE_PREVIEW_CHARS) + "...";
    }
}