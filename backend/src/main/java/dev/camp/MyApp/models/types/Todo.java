package dev.camp.MyApp.models.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.camp.MyApp.models.CreationSource;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "todos")
public class Todo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    public User user;

    public String title;
    public Boolean completed = Boolean.FALSE;

    @Column(length = 1000)
    public String notes;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    public CreationSource createdVia;

    public String createdByUsername;

    public String createdByPhone;

    public LocalDateTime createdAt;
    public LocalDateTime dueAt;
    public LocalDateTime todoDate;
    public String section;

    @Column(nullable = false)
    public int sortOrder;
}