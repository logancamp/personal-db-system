package dev.camp.MyApp.models.types;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "item_revisions", indexes = {
        @Index(name = "idx_revision_lookup", columnList = "entityKind,entityId,ownerUserId"),
        @Index(name = "idx_revision_purge", columnList = "ownerUserId,changedAt")
})
public class ItemRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 16)
    public String entityKind;

    @Column(nullable = false)
    public Long entityId;

    @Column(nullable = false)
    public Long ownerUserId;

    public String changedBy;

    @Column(nullable = false)
    public LocalDateTime changedAt;

    @Column(nullable = false, length = 8)
    public String changeType;

    @JdbcTypeCode(SqlTypes.JSON)
    public Map<String, Object> state = new HashMap<>();

    public ItemRevision() {}
}