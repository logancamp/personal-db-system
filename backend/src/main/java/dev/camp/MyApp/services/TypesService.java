package dev.camp.MyApp.services;

import dev.camp.MyApp.models.TypeItemRepository;
import dev.camp.MyApp.models.TypeRepository;
import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.types.Type;
import dev.camp.MyApp.models.types.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class TypesService {
    private final TypeRepository typeRepository;
    private final TypeItemRepository typeItemRepository;
    private final RevisionRecorder revisionRecorder;

    public TypesService(TypeRepository typeRepository, TypeItemRepository typeItemRepository,
                        RevisionRecorder revisionRecorder) {
        this.typeRepository = typeRepository;
        this.typeItemRepository = typeItemRepository;
        this.revisionRecorder = revisionRecorder;
    }

    public Type create(Type type, Long userId) {
        return create(type, userId, CreationSource.WEB, null);
    }

    public Type create(Type type, Long userId, CreationSource source, String createdByPhone) {
        type.id = 0;
        type.user = new User();
        type.user.id = userId;
        type.createdVia = source;
        type.createdByPhone = createdByPhone;
        Type saved = typeRepository.save(type);
        revisionRecorder.recordAdd(saved);
        return saved;
    }

    public List<Type> findAllForUser(String username) {
        return typeRepository.findAllByUser_UsernameOrderByNameAsc(username);
    }

    public Type update(Long id, Type updates, Long userId) {
        Type type = typeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!type.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        type.name = updates.name;
        Type saved = typeRepository.save(type);
        revisionRecorder.recordUpdate(saved);
        return saved;
    }

    public void delete(Long id, Long userId) {
        Type type = typeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!type.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (!typeItemRepository.findAllByType_Id(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Move or delete items using this type first.");
        }
        revisionRecorder.recordDelete(type);
        typeRepository.delete(type);
    }
}