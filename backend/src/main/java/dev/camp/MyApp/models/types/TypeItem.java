package dev.camp.MyApp.models.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.camp.MyApp.models.CreationSource;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "my_items")
public class TypeItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    public User user;
    public String customName;

    @ManyToOne
    @JoinColumn(name = "type_id")
    public Type type;

    // The web client sends the type as a plain id; resolved to `type` on create.
    @Transient
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public Long typeId;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    public CreationSource createdVia;

    public String createdByPhone;

    @JdbcTypeCode(SqlTypes.JSON)
    public Map<String, Object> fields = new HashMap<>();

    public LocalDateTime createdAt = LocalDateTime.now();
}