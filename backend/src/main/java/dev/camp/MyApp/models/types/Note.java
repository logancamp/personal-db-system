package dev.camp.MyApp.models.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.camp.MyApp.models.CreationSource;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "notes")
public class Note {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    public User user;

    @Column(length = 2000)
    public String content;

    public String createdByUsername;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    public CreationSource createdVia;

    public String createdByPhone;

    public LocalDateTime createdAt;
    public String section;
}