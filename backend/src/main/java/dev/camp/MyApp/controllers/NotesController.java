package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.NotesService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/note")
public class NotesController {
    private final NotesService notesService;

    public NotesController(NotesService notesService) {
        this.notesService = notesService;
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
        }
        return principal;
    }

    @PostMapping
    public void save(@RequestBody Note note, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        notesService.create(note, principal.getId());
    }

    @GetMapping
    public List<Note> findAll(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return notesService.findAllForUser(principal.getUsername());
    }

    @PutMapping("/{id}")
    public Note update(@PathVariable Long id, @RequestBody NoteUpdateRequest updates,
                       Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return notesService.update(id, updates, principal.getId());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        notesService.delete(id, principal.getId());
    }
}