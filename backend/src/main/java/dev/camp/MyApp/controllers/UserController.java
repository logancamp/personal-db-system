package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.types.User;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    @PostMapping
    public User createUser(@RequestBody User user) {
        return userService.createUser(user);
    }

    @PatchMapping("/{username}")
    public User verifyUser(@PathVariable String username, @RequestBody User user) {
        return userService.verifyUser(username, user);
    }

    @GetMapping
    public List<User> findAll() {
        return userService.findAll();
    }

    @GetMapping("/me")
    public MeResponse getMe(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return userService.getMe(principal.getId());
    }

    @PutMapping("/me/llm-key")
    public void setLlmApiKey(@RequestBody SetLlmKeyRequest request, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        userService.setLlmApiKey(principal.getId(), request.provider, request.apiKey);
    }

    @DeleteMapping("/me/llm-key")
    public void clearLlmApiKey(@RequestParam String provider, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        userService.clearLlmApiKey(principal.getId(), provider);
    }

    @PutMapping("/me/provider")
    public void setLlmProvider(@RequestBody SetLlmProviderRequest request, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        userService.setLlmProvider(principal.getId(), request.provider);
    }

    @PutMapping("/me/ai-mode")
    public void setAiExecutionMode(@RequestBody SetAiModeRequest request, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        userService.setAiExecutionMode(principal.getId(), request.mode, request.localLlmAddress);
    }

    @PutMapping("/me/inbox-provider")
    public void setInboxProvider(@RequestBody SetInboxProviderRequest request, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        userService.setInboxProvider(principal.getId(), request.provider);
    }

    @PutMapping("/me/auto-reply")
    public void setAutoReplyEnabled(@RequestBody SetAutoReplyRequest request, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        userService.setAutoReplyEnabled(principal.getId(), request.enabled);
    }

    @PutMapping("/me/history")
    public void setHistorySettings(@RequestBody SetHistoryRequest request, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        userService.setHistorySettings(principal.getId(), request.enabled, request.retentionDays);
    }

    public static class SetHistoryRequest {
        public boolean enabled;
        public Integer retentionDays;
    }

    public static class SetLlmKeyRequest {
        public String provider;
        public String apiKey;
    }

    public static class SetLlmProviderRequest {
        public String provider;
    }

    public static class SetAiModeRequest {
        public String mode;
        public String localLlmAddress;
    }

    public static class SetInboxProviderRequest {
        public String provider;
    }

    public static class SetAutoReplyRequest {
        public boolean enabled;
    }
}