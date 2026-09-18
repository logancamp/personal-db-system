package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.models.types.User;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.HistoryPurgeService;
import dev.camp.MyApp.services.HistoryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/history")
public class HistoryController {
    private final HistoryService historyService;
    private final HistoryPurgeService historyPurgeService;
    private final UserRepository userRepository;

    public HistoryController(HistoryService historyService, HistoryPurgeService historyPurgeService, UserRepository userRepository) {
        this.historyService = historyService;
        this.historyPurgeService = historyPurgeService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public HistoryFeedResponse feed(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Integer limit,
            Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return historyService.feed(user, since, cursor, limit);
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    @GetMapping("/{entityKind}/{id}")
    public HistoryService.HistoryResponse getHistory(
            @PathVariable String entityKind,
            @PathVariable Long id,
            Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return historyService.getHistory(entityKind, id, principal.getId());
    }

    @DeleteMapping("/me")
    public PurgeResult purgeMyHistory(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return new PurgeResult(historyPurgeService.purgeAllForUser(principal.getId()));
    }

    @DeleteMapping("/me/older-than/{days}")
    public PurgeResult purgeMyOldHistory(@PathVariable int days, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        if (days < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "days must be >= 0");
        }
        return new PurgeResult(historyPurgeService.purgeOlderThan(principal.getId(), days));
    }

    public record PurgeResult(int deletedRevisions) {}
}