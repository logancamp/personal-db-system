package dev.camp.MyApp.models.types;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "users")
public class User {
    @Id
    @JsonIgnore
    @GeneratedValue( strategy = GenerationType.IDENTITY )
    public Long id;

    public String username;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String password;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String pin;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public Boolean verified;

    @JsonIgnore
    public LocalDateTime verificationDeadline;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String role;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public boolean historyEnabled = true;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public Integer historyRetentionDays;

    // provider -> encrypted API key. Never serialized; see ApiKeyEncryptionService.
    @ElementCollection
    @CollectionTable(name = "user_llm_keys", joinColumns = @JoinColumn(name = "user_id"))
    @MapKeyColumn(name = "provider")
    @Column(name = "api_key", length = 500)
    @JsonIgnore
    public Map<String, String> llmApiKeys = new HashMap<>();

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String llmProvider;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String aiExecutionMode;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String localLlmAddress;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String systemPrompt;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String model;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String inboxLlmProvider;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String inboxModel;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    public String inboxSystemPrompt;

    public boolean autoReplyEnabled;

    public User() {}
}