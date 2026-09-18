package dev.camp.MyApp.services;

import dev.camp.MyApp.controllers.HistoryFeedResponse;
import dev.camp.MyApp.models.ItemRevisionRepository;
import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.models.types.ItemRevision;
import dev.camp.MyApp.models.types.User;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
public class HistoryService {
    public record HistoryResponse(boolean historyEnabled, List<Revision> revisions) {
    }

    public record Revision(
            long revisionId,
            LocalDateTime changedAt,
            String changedBy,
            String changeType,
            Object state) {
    }

    private static final Set<String> VALID_ENTITY_KINDS = Set.of("todo", "note", "type", "item");

    private static final int DEFAULT_FEED_LIMIT = 50;
    private static final int MAX_FEED_LIMIT = 200;

    private static final LocalDateTime BEGINNING_OF_TIME = LocalDateTime.of(1970, 1, 1, 0, 0);

    private final ItemRevisionRepository revisionRepository;
    private final UserRepository userRepository;

    public HistoryService(ItemRevisionRepository revisionRepository, UserRepository userRepository) {
        this.revisionRepository = revisionRepository;
        this.userRepository = userRepository;
    }

    public HistoryResponse getHistory(String entityKind, Long entityId, Long userId) {
        String kind = entityKind == null ? "" : entityKind.toLowerCase();
        if (!VALID_ENTITY_KINDS.contains(kind)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown entity kind: " + entityKind + ". Expected one of " + VALID_ENTITY_KINDS);
        }
        if (!historyEnabled(userId)) {
            return new HistoryResponse(false, List.of());
        }

        List<Revision> revisions = revisionRepository
                .findByOwnerUserIdAndEntityKindAndEntityIdOrderByIdAsc(userId, kind, entityId)
                .stream()
                .map(r -> new Revision(r.id, r.changedAt, r.changedBy, r.changeType, r.state))
                .toList();

        return new HistoryResponse(true, revisions);
    }

    // Every read is scoped by ownerUserId, so a forged cursor or id can't reach another user's log.
    public HistoryFeedResponse feed(User user, LocalDateTime since, Long cursor, Integer limit) {
        if (!user.historyEnabled) {
            return new HistoryFeedResponse(false, List.of(), null);
        }

        int pageSize = Math.min(
                limit == null ? DEFAULT_FEED_LIMIT : Math.max(limit, 1),
                MAX_FEED_LIMIT);

        List<ItemRevision> rows = revisionRepository
                .findByOwnerUserIdAndChangedAtGreaterThanEqualAndIdLessThanOrderByIdDesc(
                        user.id,
                        since == null ? BEGINNING_OF_TIME : since,
                        cursor == null ? Long.MAX_VALUE : cursor,
                        Limit.of(pageSize));

        List<HistoryFeedResponse.FeedRevision> revisions = rows.stream()
                .map(r -> new HistoryFeedResponse.FeedRevision(
                        r.id, r.entityKind, r.entityId, r.changedAt, r.changedBy,
                        r.changeType, r.state))
                .toList();

        Long nextCursor = rows.size() < pageSize ? null : rows.getLast().id;

        return new HistoryFeedResponse(true, revisions, nextCursor);
    }

    private boolean historyEnabled(Long userId) {
        return userRepository.findById(userId)
                .map(u -> u.historyEnabled)
                .orElse(false);
    }
}