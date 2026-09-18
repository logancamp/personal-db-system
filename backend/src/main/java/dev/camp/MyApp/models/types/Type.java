package dev.camp.MyApp.models.types;

import dev.camp.MyApp.models.CreationSource;
import jakarta.persistence.*;

@Entity
@Table(name = "item_types")
public class Type {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    public User user;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    public CreationSource createdVia;

    public String createdByPhone;

    @Column(nullable = false)
    public String name;
}