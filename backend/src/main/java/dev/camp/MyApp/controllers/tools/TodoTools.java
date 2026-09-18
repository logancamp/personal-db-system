package dev.camp.MyApp.controllers.tools;

import dev.camp.MyApp.controllers.TodoUpdateRequest;
import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.types.Todo;
import dev.camp.MyApp.services.TodosService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;

// Every tool parameter is a required string, and an empty string means "not provided".
// Optional or nullable parameters get rejected by providers with strict schema validation.
// Note the asymmetry with the REST API: over REST "" clears a field, from a tool "" leaves
// it unchanged, so a model that omits a value can't wipe data.
@Component
public class TodoTools {
    private final TodosService todosService;
    private final CurrentUser currentUser;

    public TodoTools(TodosService todosService, CurrentUser currentUser) {
        this.todosService = todosService;
        this.currentUser = currentUser;
    }

    @Tool(name = "list_todos", description = "List the user's todos. Pass an empty string for section to list all of them.")
    public List<Todo> listTodos(
            @ToolParam(description = "Only return todos in this section. Empty string means all sections.", required = true)
            String section) {
        List<Todo> all = todosService.findAllForUser(currentUser.username());
        if (isBlank(section)) {
            return all;
        }
        return all.stream().filter(t -> section.equalsIgnoreCase(t.section)).toList();
    }

    @Tool(name = "add_todo", description = "Create a new todo. Pass an empty string for any field you weren't given -- never omit a parameter and never send null. If this returns DUPLICATE, tell the user what already exists and ask whether they want it added anyway.")
    public String addTodo(
            @ToolParam(description = "Todo title", required = true) String title,
            @ToolParam(description = "Extra notes, or an empty string if none", required = true) String notes,
            @ToolParam(description = "Deadline as YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, or an empty string if none", required = true) String dueAt,
            @ToolParam(description = "The day this belongs on as YYYY-MM-DD, or an empty string if none", required = true) String todoDate) {
        Todo similar = findSimilar(title);
        if (similar != null) {
            return "DUPLICATE: a similar todo already exists -- [" + similar.id + "] \""
                    + similar.title + "\". Tell the user this and ask whether they want it "
                    + "added anyway, or whether they meant to update the existing one. Only if "
                    + "they confirm, call add_duplicate_todo.";
        }

        return save(title, notes, dueAt, todoDate);
    }

    @Tool(name = "add_duplicate_todo", description = "Create a todo even though a similar one already exists. ONLY call this after the user has explicitly confirmed they want a duplicate. Never call it as a first attempt -- use add_todo.")
    public String addDuplicateTodo(
            @ToolParam(description = "Todo title", required = true) String title,
            @ToolParam(description = "Extra notes, or an empty string if none", required = true) String notes,
            @ToolParam(description = "Deadline as YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, or an empty string if none", required = true) String dueAt,
            @ToolParam(description = "The day this belongs on as YYYY-MM-DD, or an empty string if none", required = true) String todoDate) {
        return save(title, notes, dueAt, todoDate);
    }

    @Tool(name = "update_todo", description = "Change an existing todo. Pass an empty string for any field you are NOT changing -- empty means leave it alone.")
    public String updateTodo(
            @ToolParam(description = "The id of the todo", required = true) Long id,
            @ToolParam(description = "New title, or empty string to leave unchanged", required = true) String title,
            @ToolParam(description = "New notes, or empty string to leave unchanged", required = true) String notes,
            @ToolParam(description = "New deadline as YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, or empty string to leave unchanged", required = true) String dueAt,
            @ToolParam(description = "New day as YYYY-MM-DD, or empty string to leave unchanged", required = true) String todoDate) {
        Todo saved = todosService.update(id, new TodoUpdateRequest(
                blankToNull(title), null, blankToNull(notes), null,
                blankToNull(dueAt), blankToNull(todoDate), null), currentUser.id());
        ActionLog.record("updated the todo \"" + saved.title + "\"");
        return "Updated todo " + saved.id + ": " + saved.title;
    }

    @Tool(name = "complete_todo", description = "Mark a todo as done.")
    public String completeTodo(
            @ToolParam(description = "The id of the todo", required = true) Long id) {
        Todo saved = todosService.update(id,
                new TodoUpdateRequest(null, true, null, null, null, null, null), currentUser.id());
        ActionLog.record("marked \"" + saved.title + "\" done");
        return "Completed todo " + saved.id + ": " + saved.title;
    }

    @Tool(name = "reopen_todo", description = "Mark a completed todo as not done.")
    public String reopenTodo(
            @ToolParam(description = "The id of the todo", required = true) Long id) {
        Todo saved = todosService.update(id,
                new TodoUpdateRequest(null, false, null, null, null, null, null), currentUser.id());
        ActionLog.record("reopened \"" + saved.title + "\"");
        return "Reopened todo " + saved.id + ": " + saved.title;
    }

    @Tool(name = "delete_todo", description = "Permanently delete a todo.")
    public String deleteTodo(
            @ToolParam(description = "The id of the todo", required = true) Long id) {
        todosService.delete(id, currentUser.id());
        ActionLog.record("deleted todo " + id);
        return "Deleted todo " + id;
    }

    private Todo findSimilar(String title) {
        for (Todo existing : todosService.findAllForUser(currentUser.username())) {
            if (!Boolean.TRUE.equals(existing.completed)
                    && ItemSimilarity.looksLikeDuplicate(title, existing.title)) {
                return existing;
            }
        }
        return null;
    }

    private String save(String title, String notes, String dueAt, String todoDate) {
        Todo todo = new Todo();
        todo.title = title;
        todo.notes = blankToNull(notes);
        todo.dueAt = isBlank(dueAt) ? null : TodosService.parseDateOrThrow(dueAt, "dueAt");
        todo.todoDate = isBlank(todoDate) ? null : TodosService.parseDateOrThrow(todoDate, "todoDate");
        Todo saved = todosService.create(todo, currentUser.id(), CreationSource.WEB, null);
        ActionLog.record("added the todo \"" + saved.title + "\"");
        return "Created todo " + saved.id + ": " + saved.title;
    }

    static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    static String blankToNull(String s) {
        return isBlank(s) ? null : s;
    }
}