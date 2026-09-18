package dev.camp.MyApp.services;

import dev.camp.MyApp.models.TypeItemRepository;
import dev.camp.MyApp.models.TypeRepository;
import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.types.Type;
import dev.camp.MyApp.models.types.TypeItem;
import dev.camp.MyApp.models.types.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TypeItemsService {
    private final TypeItemRepository typeItemRepository;
    private final TypeRepository typeRepository;
    private final RevisionRecorder revisionRecorder;

    public TypeItemsService(TypeItemRepository typeItemRepository, TypeRepository typeRepository,
                            RevisionRecorder revisionRecorder) {
        this.typeItemRepository = typeItemRepository;
        this.typeRepository = typeRepository;
        this.revisionRecorder = revisionRecorder;
    }

    public TypeItem create(TypeItem item, Long userId) {
        return create(item, userId, CreationSource.WEB, null);
    }

    public TypeItem create(TypeItem item, Long userId, CreationSource source, String createdByPhone) {
        item.id = 0;
        if (item.type == null && item.typeId != null) {
            item.type = new Type();
            item.type.id = item.typeId;
        }
        if (item.type != null) {
            item.type = ownedType(item.type.id, userId);
        }
        item.user = new User();
        item.user.id = userId;
        item.createdAt = LocalDateTime.now();
        item.createdVia = source;
        item.createdByPhone = createdByPhone;
        TypeItem saved = typeItemRepository.save(item);
        revisionRecorder.recordAdd(saved);
        return saved;
    }

    public List<TypeItem> findAllForUser(String username, Long typeId) {
        if (typeId != null) {
            return typeItemRepository.findAllByUser_UsernameAndType_IdOrderByIdAsc(username, typeId);
        }
        return typeItemRepository.findAllByUser_UsernameOrderByIdAsc(username);
    }

    public TypeItem update(Long id, TypeItem updates, Long userId) {
        TypeItem item = typeItemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!item.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (updates.customName != null) {
            item.customName = updates.customName;
        }
        if (updates.fields != null) {
            item.fields.putAll(updates.fields);
        }
        TypeItem saved = typeItemRepository.save(item);
        revisionRecorder.recordUpdate(saved);
        return saved;
    }

    public void delete(Long id, Long userId) {
        TypeItem item = typeItemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!item.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        revisionRecorder.recordDelete(item);
        typeItemRepository.delete(item);
    }

    // Same response for "missing" and "someone else's" so ids can't be probed.
    private Type ownedType(long typeId, Long userId) {
        Type type = typeRepository.findById(typeId).orElse(null);
        if (type == null || type.user == null || !type.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown type.");
        }
        return type;
    }
}
