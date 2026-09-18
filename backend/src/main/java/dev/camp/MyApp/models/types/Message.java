package dev.camp.MyApp.models.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.camp.MyApp.models.MessageTarget;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name="messages")
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public long id;

    @Column(length = 1000)
    public String msg;
    public LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(nullable = false)
    public User from;

    @ManyToOne
    @JoinColumn(nullable = false)
    public User to;

    public boolean generatedByBot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public MessageTarget target = MessageTarget.PERSON;

    public LocalDateTime readAt;

    @Transient
    public String getKind() {
        if (!generatedByBot) {
            return "USER";
        }
        boolean selfChat = from != null && to != null
                && from.username != null && from.username.equals(to.username);
        return selfChat ? "ASSISTANT_REPLY" : "ON_BEHALF_CONFIRMATION";
    }
}