package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.types.TypeItem;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.TypeItemsService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/typeItems")
public class TypeItemsController {
    private final TypeItemsService typeItemsService;

    public TypeItemsController(TypeItemsService typeItemService) {
        this.typeItemsService = typeItemService;
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
        }
        return principal;
    }

    @PostMapping
    public void save(@RequestBody TypeItem item, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        typeItemsService.create(item, principal.getId());
    }

    @GetMapping
    public List<TypeItem> findAll(Authentication authentication,
                                  @RequestParam(required = false) Long type,
                                  @RequestParam(required = false) Long typeId) {
        UserPrincipal principal = requirePrincipal(authentication);
        return typeItemsService.findAllForUser(principal.getUsername(), type != null ? type : typeId);
    }

    @PutMapping("/{id}")
    public TypeItem update(@PathVariable Long id, @RequestBody TypeItem updates, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return typeItemsService.update(id, updates, principal.getId());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        typeItemsService.delete(id, principal.getId());
    }
}