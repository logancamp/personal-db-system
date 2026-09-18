package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.types.Todo;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.TodosService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/todo")
public class TodosController {
    private final TodosService todosService;

    public TodosController(TodosService todosService) {
        this.todosService = todosService;
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
        }
        return principal;
    }

    @PostMapping
    public void save(@RequestBody Todo todo, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        todosService.create(todo, principal.getId());
    }

    @GetMapping
    public List<Todo> findAll(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return todosService.findAllForUser(principal.getUsername());
    }

    @PutMapping("/{id}")
    public Todo update(@PathVariable Long id, @RequestBody TodoUpdateRequest updates,
                       Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return todosService.update(id, updates, principal.getId());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        todosService.delete(id, principal.getId());
    }

    @PutMapping("/positions")
    public PositionUpdateResult updatePositions(@RequestBody List<TodoPositionUpdate> updates,
                                                Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return new PositionUpdateResult(todosService.updatePositions(updates, principal.getId()));
    }

    public record PositionUpdateResult(int updated) {}
}