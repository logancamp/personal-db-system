package dev.camp.MyApp.services;

import dev.camp.MyApp.controllers.MeResponse;
import dev.camp.MyApp.models.types.User;
import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.security.Roles;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserService {
    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private static final List<String> VALID_PROVIDERS = List.of("CEREBRAS", "GROQ", "GEMINI", "OPENAI", "ANTHROPIC");
    private static final int MAX_PIN_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final ApiKeyEncryptionService apiKeyEncryptionService;
    private final HistoryPurgeService historyPurgeService;
    private final PasswordEncoder passwordEncoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
    private final Map<String, Integer> pinAttempts = new ConcurrentHashMap<>();

    public UserService(UserRepository userRepository, ApiKeyEncryptionService apiKeyEncryptionService,
                       HistoryPurgeService historyPurgeService) {
        this.userRepository = userRepository;
        this.apiKeyEncryptionService = apiKeyEncryptionService;
        this.historyPurgeService = historyPurgeService;
    }

    private boolean isValidUsername(String username) {
        return username != null && username.matches("[a-zA-Z0-9_-]+");
    }

    public User createUser(User user) {
        if (!isValidUsername(user.username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username may only contain letters, numbers, underscores, and hyphens.");
        }
        if (userRepository.findByUsername(user.username) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid username or email");
        }
        if (userRepository.findByEmail(user.email) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid username or email");
        }
        if (user.password == null || user.password.length() < 15) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 15 characters long");
        }

        user.password = passwordEncoder.encode(user.password);
        user.role = Roles.ADMIN;
        user.verified = false;
        user.verificationDeadline = LocalDateTime.now().plusMinutes(10);
        String pin = String.format("%06d", RANDOM.nextInt(1_000_000));
        user.pin = pin;
        user.llmProvider = "CEREBRAS";
        user.aiExecutionMode = "SERVER";

        User saved = userRepository.save(user);
        // There is no email or SMS delivery yet; the operator reads the PIN from the server log.
        log.info("Verification PIN for user '{}': {} (valid for 10 minutes)", saved.username, pin);
        return saved;
    }

    public User verifyUser(String username, User submitted) {
        User existing = userRepository.findByUsername(username);
        if (existing == null || existing.pin == null || existing.verificationDeadline == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid PIN");
        }
        if (pinAttempts.getOrDefault(username, 0) >= MAX_PIN_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts");
        }

        boolean pinMatches = submitted.pin != null && MessageDigest.isEqual(
                submitted.pin.getBytes(StandardCharsets.UTF_8), existing.pin.getBytes(StandardCharsets.UTF_8));
        if (pinMatches && LocalDateTime.now().isBefore(existing.verificationDeadline)) {
            existing.verified = true;
            existing.pin = null;
            pinAttempts.remove(username);
        } else {
            pinAttempts.merge(username, 1, Integer::sum);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid PIN");
        }
        return userRepository.save(existing);
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public MeResponse getMe(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        Map<String, Boolean> keysSet = new HashMap<>();
        for (String provider : VALID_PROVIDERS) {
            String stored = user.llmApiKeys.get(provider);
            keysSet.put(provider, stored != null && !stored.isBlank());
        }

        return new MeResponse(
                user.username,
                user.email,
                user.verified,
                user.role,
                user.llmProvider,
                keysSet,
                user.model,
                user.systemPrompt,
                user.aiExecutionMode,
                user.localLlmAddress,
                user.autoReplyEnabled,
                user.inboxLlmProvider,
                user.inboxModel,
                user.inboxSystemPrompt,
                user.historyEnabled,
                user.historyRetentionDays
        );
    }

    public Map<String, String> getLlmApiKeys(User user) {
        Map<String, String> decrypted = new java.util.HashMap<>();
        for (Map.Entry<String, String> entry : user.llmApiKeys.entrySet()) {
            decrypted.put(entry.getKey(), apiKeyEncryptionService.decrypt(entry.getValue()));
        }
        return decrypted;
    }

    public void setLlmApiKey(Long userId, String provider, String apiKey) {
        if (!VALID_PROVIDERS.contains(provider.toUpperCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "provider must be CEREBRAS, GROQ, GEMINI, OPENAI, or ANTHROPIC");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.llmApiKeys.put(provider.toUpperCase(), apiKeyEncryptionService.encrypt(apiKey));
        userRepository.save(user);
    }

    public void clearLlmApiKey(Long userId, String provider) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.llmApiKeys.remove(provider.toUpperCase());
        userRepository.save(user);
    }

    public void setLlmProvider(Long userId, String provider) {
        if (!VALID_PROVIDERS.contains(provider.toUpperCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "provider must be CEREBRAS, GROQ, GEMINI, OPENAI, or ANTHROPIC");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.llmProvider = provider.toUpperCase();
        userRepository.save(user);
    }

    public void setAiExecutionMode(Long userId, String mode, String localLlmAddress) {
        if (!List.of("SERVER", "CLIENT").contains(mode.toUpperCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mode must be SERVER or CLIENT");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.aiExecutionMode = mode.toUpperCase();
        user.localLlmAddress = localLlmAddress;
        userRepository.save(user);
    }

    public void setInboxProvider(Long userId, String provider) {
        if (!VALID_PROVIDERS.contains(provider.toUpperCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "provider must be CEREBRAS, GROQ, GEMINI, OPENAI, or ANTHROPIC");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.inboxLlmProvider = provider.toUpperCase();
        userRepository.save(user);
    }

    public void setAutoReplyEnabled(Long userId, boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.autoReplyEnabled = enabled;
        userRepository.save(user);
    }

    public void setHistorySettings(Long userId, boolean enabled, Integer retentionDays) {
        if (retentionDays != null && retentionDays < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "retentionDays must be >= 0 or null");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean wasEnabled = user.historyEnabled;
        user.historyEnabled = enabled;
        user.historyRetentionDays = retentionDays;
        userRepository.save(user);

        if (wasEnabled && !enabled) {
            historyPurgeService.purgeAllForUser(userId);
        }
    }
}