package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.types.Type;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.TypesService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/types")
public class TypesController {
    private final TypesService typesService;

    public TypesController(TypesService typeService) {
        this.typesService = typeService;
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
        }
        return principal;
    }

    @PostMapping
    public Type save(@RequestBody Type type, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return typesService.create(type, principal.getId());
    }

    @GetMapping
    public List<Type> findAll(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return typesService.findAllForUser(principal.getUsername());
    }

    @PutMapping("/{id}")
    public Type update(@PathVariable Long id, @RequestBody Type updates, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return typesService.update(id, updates, principal.getId());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        typesService.delete(id, principal.getId());
    }
}