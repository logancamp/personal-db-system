package dev.camp.MyApp.controllers.tools;

import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.models.types.Todo;
import dev.camp.MyApp.services.NotesService;
import dev.camp.MyApp.services.TodosService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

// Create-only on purpose, and the only tool set the on-behalf agent is given.
// That agent acts on a stranger's message, so there must be no read, update, delete or
// send_message tool here: an injected prompt could then read the recipient's data or
// message third parties. Items always land in the fixed "Inbox" section.
@Component
public class InboxTools {
    private static final String INBOX_SECTION = "Inbox";

    private static final ThreadLocal<List<String>> CREATED = ThreadLocal.withInitial(ArrayList::new);

    private final TodosService todosService;
    private final NotesService notesService;
    private final CurrentUser currentUser;

    public InboxTools(TodosService todosService, NotesService notesService, CurrentUser currentUser) {
        this.todosService = todosService;
        this.notesService = notesService;
        this.currentUser = currentUser;
    }

    public static void beginTracking() {
        CREATED.get().clear();
    }

    public static List<String> collectTracked() {
        List<String> copy = List.copyOf(CREATED.get());
        CREATED.remove();
        return copy;
    }

    public static boolean hasCreatedAnything() {
        return !CREATED.get().isEmpty();
    }

    @Tool(name = "add_inbox_todo", description = "Add a todo to the recipient's Inbox on their behalf. Pass an empty string for notes if there are none. Only use this when the message clearly asks for a task or reminder to be created.")
    public Todo addInboxTodo(
            @ToolParam(description = "Todo title", required = true) String title,
            @ToolParam(description = "Extra notes, or an empty string if none", required = true) String notes) {
        Todo todo = new Todo();
        todo.title = title;
        todo.notes = (notes == null || notes.isBlank()) ? null : notes;
        todo.section = INBOX_SECTION;
        todo.createdByUsername = currentUser.initiatedBy();
        Todo saved = todosService.create(todo, currentUser.id(), CreationSource.ON_BEHALF_AGENT, null);
        CREATED.get().add("todo: " + title);
        return saved;
    }

    @Tool(name = "add_inbox_note", description = "Add a note to the recipient's Inbox on their behalf. Only use this when the message clearly asks for something to be noted or saved.")
    public Note addInboxNote(@ToolParam(description = "Note content", required = true) String content) {
        Note note = new Note();
        note.content = content;
        note.section = INBOX_SECTION;
        note.createdByUsername = currentUser.initiatedBy();
        Note saved = notesService.create(note, currentUser.id(), CreationSource.ON_BEHALF_AGENT, null);
        CREATED.get().add("note: " + content);
        return saved;
    }
}