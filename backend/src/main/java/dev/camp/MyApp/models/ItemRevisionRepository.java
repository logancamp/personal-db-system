package dev.camp.MyApp.models;

import dev.camp.MyApp.models.types.ItemRevision;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ItemRevisionRepository extends JpaRepository<ItemRevision, Long> {
    List<ItemRevision> findByEntityKindAndEntityIdAndOwnerUserIdOrderByIdAsc(
            String entityKind, Long entityId, Long ownerUserId);

    long deleteByOwnerUserId(Long ownerUserId);

    long deleteByOwnerUserIdAndChangedAtBefore(Long ownerUserId, LocalDateTime cutoff);

    List<ItemRevision> findByOwnerUserIdAndChangedAtGreaterThanEqualAndIdLessThanOrderByIdDesc(
            Long ownerUserId, LocalDateTime since, Long cursor, Limit limit);

    List<ItemRevision> findByOwnerUserIdAndEntityKindAndEntityIdOrderByIdAsc(Long id, String kind, Long entityId);
}