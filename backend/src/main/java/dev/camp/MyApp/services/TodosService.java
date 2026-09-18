package dev.camp.MyApp.services;

import dev.camp.MyApp.controllers.TodoPositionUpdate;
import dev.camp.MyApp.controllers.TodoUpdateRequest;
import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.TodoRepository;
import dev.camp.MyApp.models.types.Todo;
import dev.camp.MyApp.models.types.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class TodosService {
    // New todos are placed 1000 apart so a drag is a single update between two neighbours.
    private static final int POSITION_GAP = 1000;

    private final TodoRepository todoRepository;
    private final RevisionRecorder revisionRecorder;

    public TodosService(TodoRepository todoRepository, RevisionRecorder revisionRecorder) {
        this.todoRepository = todoRepository;
        this.revisionRecorder = revisionRecorder;
    }

    public Todo create(Todo todo, Long userId) {
        return create(todo, userId, CreationSource.WEB, null);
    }

    public Todo create(Todo todo, Long userId, CreationSource source, String createdByPhone) {
        todo.id = 0;
        todo.user = new User();
        todo.user.id = userId;
        todo.createdAt = LocalDateTime.now();
        todo.createdVia = source;
        todo.createdByPhone = createdByPhone;

        if (todo.sortOrder == 0) {
            todo.sortOrder = nextPosition(userId);
        }

        Todo saved = todoRepository.save(todo);
        revisionRecorder.recordAdd(saved);
        return saved;
    }

    public List<Todo> findAllForUser(String username) {
        return todoRepository.findAllByUser_UsernameOrderBySortOrderAscIdAsc(username);
    }

    // One rule per field: null leaves it alone, "" clears it, anything else sets it.
    public Todo update(Long id, TodoUpdateRequest updates, Long userId) {
        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!todo.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        if (updates.title() != null) {
            if (updates.title().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title cannot be empty.");
            }
            todo.title = updates.title();
        }
        if (updates.completed() != null) {
            todo.completed = updates.completed();
        }
        if (updates.notes() != null) {
            todo.notes = blankToNull(updates.notes());
        }
        if (updates.section() != null) {
            todo.section = blankToNull(updates.section());
        }
        if (updates.dueAt() != null) {
            todo.dueAt = updates.dueAt().isBlank() ? null : parseDateOrThrow(updates.dueAt(), "dueAt");
        }
        if (updates.todoDate() != null) {
            todo.todoDate = updates.todoDate().isBlank() ? null : parseDateOrThrow(updates.todoDate(), "todoDate");
        }
        if (updates.sortOrder() != null) {
            todo.sortOrder = updates.sortOrder();
        }

        Todo saved = todoRepository.save(todo);
        revisionRecorder.recordUpdate(saved);
        return saved;
    }

    @Transactional
    public int updatePositions(List<TodoPositionUpdate> updates, Long userId) {
        if (updates == null || updates.isEmpty()) {
            return 0;
        }
        int changed = 0;
        for (TodoPositionUpdate u : updates) {
            if (u.id() == null || u.sortOrder() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Each entry needs both id and sortOrder.");
            }
            Todo todo = todoRepository.findById(u.id())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "No todo " + u.id()));
            if (!todo.user.id.equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
            todo.sortOrder = u.sortOrder();
            Todo saved = todoRepository.save(todo);
            revisionRecorder.recordUpdate(saved);
            changed++;
        }
        return changed;
    }

    public void delete(Long id, Long userId) {
        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!todo.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        revisionRecorder.recordDelete(todo);
        todoRepository.delete(todo);
    }

    private int nextPosition(Long userId) {
        return todoRepository.findFirstByUser_IdOrderBySortOrderDesc(userId)
                .map(t -> t.sortOrder + POSITION_GAP)
                .orElse(POSITION_GAP);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    public static LocalDateTime parseDateOrThrow(String value, String fieldName) {
        String trimmed = value.trim();
        try {
            return LocalDateTime.parse(trimmed);
        } catch (Exception ignored) {
        }
        try {
            return LocalDate.parse(trimmed).atStartOfDay();
        } catch (Exception ignored) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    fieldName + " must be YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, got: " + value);
        }
    }
}