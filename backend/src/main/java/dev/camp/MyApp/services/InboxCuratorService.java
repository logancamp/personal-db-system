package dev.camp.MyApp.services;

import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.models.types.Todo;
import dev.camp.MyApp.models.types.User;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class InboxCuratorService {
    private static final int MAX_TOOL_CALL_ATTEMPTS = 2;
    private static final String INBOX_SECTION = "Inbox";

    private final TodosService todosService;
    private final NotesService notesService;
    private final UserRepository userRepository;
    private final UserService userService;
    private final LlmModelFactory llmModelFactory;

    public InboxCuratorService(TodosService todosService, NotesService notesService, UserRepository userRepository,
                                UserService userService, LlmModelFactory llmModelFactory) {
        this.todosService = todosService;
        this.notesService = notesService;
        this.userRepository = userRepository;
        this.userService = userService;
        this.llmModelFactory = llmModelFactory;
    }

    public InboxSummary curateInbox(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        List<Todo> inboxTodos = todosService.findAllForUser(user.username).stream()
                .filter(t -> INBOX_SECTION.equals(t.section))
                .collect(Collectors.toList());
        List<Note> inboxNotes = notesService.findAllForUser(user.username).stream()
                .filter(n -> INBOX_SECTION.equals(n.section))
                .collect(Collectors.toList());

        int itemCount = inboxTodos.size() + inboxNotes.size();
        if (itemCount == 0) {
            return new InboxSummary("Your inbox is empty -- nothing has been added on your behalf.", 0);
        }

        String provider = user.inboxLlmProvider != null ? user.inboxLlmProvider
                : (user.llmProvider != null ? user.llmProvider : llmModelFactory.defaultProvider());
        String model = user.inboxModel != null ? user.inboxModel : user.model;

        Map<String, String> apiKeys = userService.getLlmApiKeys(user);
        String apiKey = apiKeys.get(provider.toUpperCase());
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Add your " + provider + " API key in account settings before reviewing your inbox.");
        }

        String systemPrompt = user.inboxSystemPrompt != null ? user.inboxSystemPrompt
                : "You review a list of todos and notes that other people's assistants have added to this " +
                  "user's inbox on their behalf. For each item, assign a priority of HIGH, MEDIUM, or LOW " +
                  "and a one-line reason. Then give one short overall summary sentence. Be concise.";

        StringBuilder itemsText = new StringBuilder();
        for (Todo t : inboxTodos) {
            itemsText.append("- Todo #").append(t.id).append(": ").append(t.title);
            if (t.notes != null && !t.notes.isBlank()) {
                itemsText.append(" (notes: ").append(t.notes).append(")");
            }
            itemsText.append("\n");
        }
        for (Note n : inboxNotes) {
            itemsText.append("- Note #").append(n.id).append(": ").append(n.content).append("\n");
        }

        ChatModel chatModel = llmModelFactory.build(provider, apiKey, model);

        RuntimeException lastError = null;
        String summary = null;
        for (int attempt = 1; attempt <= MAX_TOOL_CALL_ATTEMPTS && summary == null; attempt++) {
            try {
                summary = ChatClient.create(chatModel).prompt()
                        .system(systemPrompt)
                        .user("Here are the current inbox items:\n" + itemsText)
                        .call()
                        .content();
            } catch (RuntimeException e) {
                lastError = e;
            }
        }
        if (summary == null) {
            throw lastError;
        }

        return new InboxSummary(summary, itemCount);
    }

    public record InboxSummary(String summary, int itemCount) {}
}