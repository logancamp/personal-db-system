package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.models.types.Todo;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.InboxCuratorService;
import dev.camp.MyApp.services.NotesService;
import dev.camp.MyApp.services.TodosService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/inbox")
public class InboxController {
    private static final String INBOX_SECTION = "Inbox";

    private final InboxCuratorService inboxCuratorService;
    private final TodosService todosService;
    private final NotesService notesService;

    public InboxController(InboxCuratorService inboxCuratorService, TodosService todosService, NotesService notesService) {
        this.inboxCuratorService = inboxCuratorService;
        this.todosService = todosService;
        this.notesService = notesService;
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    @GetMapping("/items")
    public InboxItemsResponse getInboxItems(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        InboxItemsResponse response = new InboxItemsResponse();
        response.todos = todosService.findAllForUser(principal.getUsername()).stream()
                .filter(t -> INBOX_SECTION.equals(t.section))
                .collect(Collectors.toList());
        response.notes = notesService.findAllForUser(principal.getUsername()).stream()
                .filter(n -> INBOX_SECTION.equals(n.section))
                .collect(Collectors.toList());
        return response;
    }

    @GetMapping("/summary")
    public InboxCuratorService.InboxSummary getInboxSummary(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return inboxCuratorService.curateInbox(principal.getId());
    }

    public static class InboxItemsResponse {
        public List<Todo> todos;
        public List<Note> notes;
    }
}