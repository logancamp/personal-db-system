package dev.camp.MyApp.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.camp.MyApp.controllers.tools.CurrentUser;
import dev.camp.MyApp.models.ItemRevisionRepository;
import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.models.types.ItemRevision;
import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.models.types.Todo;
import dev.camp.MyApp.models.types.Type;
import dev.camp.MyApp.models.types.TypeItem;
import dev.camp.MyApp.models.types.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class RevisionRecorder {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .findAndRegisterModules();

    private final ItemRevisionRepository revisionRepository;
    private final UserRepository userRepository;

    public RevisionRecorder(ItemRevisionRepository revisionRepository, UserRepository userRepository) {
        this.revisionRepository = revisionRepository;
        this.userRepository = userRepository;
    }

    public void recordAdd(Object entity) {
        record(entity, "ADD");
    }

    public void recordUpdate(Object entity) {
        record(entity, "MOD");
    }

    public void recordDelete(Object entity) {
        record(entity, "DEL");
    }

    // Separate transaction so a failed audit write can never roll back the user's own change.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Object entity, String changeType) {
        if (entity == null) {
            return;
        }

        try {
            ItemRevision revision = new ItemRevision();
            revision.entityKind = kindOf(entity);
            revision.entityId = idOf(entity);
            revision.ownerUserId = ownerIdOf(entity);
            revision.changedBy = CurrentUser.auditUsername();
            revision.changedAt = LocalDateTime.now();
            revision.changeType = changeType;
            revision.state = "DEL".equals(changeType) ? null : snapshot(entity);

            if (revision.entityKind == null || revision.entityId == null || revision.ownerUserId == null) {
                return;
            }

            boolean enabled = userRepository.findById(revision.ownerUserId)
                    .map(u -> u.historyEnabled)
                    .orElse(false);
            if (!enabled) {
                return;
            }

            revisionRepository.save(revision);
        } catch (RuntimeException e) {
            System.err.println("Failed to record revision (" + changeType + ") for "
                    + entity.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    private String kindOf(Object entity) {
        return switch (entity) {
            case Todo ignored -> "todo";
            case Note ignored -> "note";
            case Type ignored -> "type";
            case TypeItem ignored -> "item";
            default -> null;
        };
    }

    private Long idOf(Object entity) {
        return switch (entity) {
            case Todo t -> t.id;
            case Note n -> n.id;
            case Type ty -> ty.id;
            case TypeItem i -> i.id;
            default -> null;
        };
    }

    private Long ownerIdOf(Object entity) {
        User owner = switch (entity) {
            case Todo t -> t.user;
            case Note n -> n.user;
            case Type ty -> ty.user;
            case TypeItem i -> i.user;
            default -> null;
        };
        if (owner != null && owner.id != null) {
            return owner.id;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> snapshot(Object entity) {
        try {
            Map<String, Object> map = MAPPER.convertValue(entity, Map.class);
            map.remove("user");
            return map;
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}