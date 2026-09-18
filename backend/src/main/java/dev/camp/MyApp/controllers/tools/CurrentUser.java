package dev.camp.MyApp.controllers.tools;

import dev.camp.MyApp.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CurrentUser {
    // Lets the on-behalf agent run as the recipient while recording who triggered it.
    private static final ThreadLocal<Identity> OVERRIDE = new ThreadLocal<>();

    private record Identity(Long id, String username, String initiatedByUsername) {}

    public Long id() {
        Identity override = OVERRIDE.get();
        return override != null ? override.id() : currentPrincipal().getId();
    }

    public String username() {
        Identity override = OVERRIDE.get();
        return override != null ? override.username() : currentPrincipal().getUsername();
    }

    public String initiatedBy() {
        Identity override = OVERRIDE.get();
        return override != null ? override.initiatedByUsername() : null;
    }

    public void runAs(Long id, String username, String initiatedByUsername, Runnable action) {
        Identity previous = OVERRIDE.get();
        OVERRIDE.set(new Identity(id, username, initiatedByUsername));
        try {
            action.run();
        } finally {
            if (previous != null) {
                OVERRIDE.set(previous);
            } else {
                OVERRIDE.remove();
            }
        }
    }

    public void runAs(Long id, String username, Runnable action) {
        runAs(id, username, null, action);
    }

    private UserPrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user for this request.");
        }
        return principal;
    }

    public static String auditUsername() {
        Identity override = OVERRIDE.get();
        if (override != null) {
            return override.initiatedByUsername() != null
                    ? override.initiatedByUsername()
                    : override.username();
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            return principal.getUsername();
        }
        return null;
    }
}