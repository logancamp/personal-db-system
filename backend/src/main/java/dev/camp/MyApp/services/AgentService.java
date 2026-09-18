package dev.camp.MyApp.services;

import dev.camp.MyApp.controllers.tools.ActionLog;
import dev.camp.MyApp.controllers.tools.CurrentUser;
import dev.camp.MyApp.controllers.tools.InboxTools;
import dev.camp.MyApp.controllers.tools.MessageTools;
import dev.camp.MyApp.controllers.tools.NoteTools;
import dev.camp.MyApp.controllers.tools.TodoTools;
import dev.camp.MyApp.controllers.tools.TypeItemTools;
import dev.camp.MyApp.controllers.tools.TypeTools;
import dev.camp.MyApp.models.MessageTarget;
import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.models.types.Message;
import dev.camp.MyApp.models.types.User;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AgentService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AgentService.class);

    private static final int MAX_TOOL_CALL_ATTEMPTS = 3;

    private static final String EMPTY_REPLY_FALLBACK = "Done.";

    private static final boolean INCLUDE_STATE_BLOCK = true;

    private final MessagesService messagesService;
    private final UserRepository userRepository;
    private final UserService userService;
    private final TodoTools todoTools;
    private final NoteTools noteTools;
    private final TypeTools typeTools;
    private final TypeItemTools typeItemTools;
    private final MessageTools messageTools;
    private final InboxTools inboxTools;
    private final CurrentUser currentUser;
    private final OnBehalfRateLimiter onBehalfRateLimiter;
    private final LlmModelFactory llmModelFactory;
    private final AgentContext agentContext;

    public AgentService(MessagesService messagesService, UserRepository userRepository, UserService userService,
                        TodoTools todoTools, NoteTools noteTools, TypeTools typeTools,
                        TypeItemTools typeItemTools, MessageTools messageTools,
                        InboxTools inboxTools, CurrentUser currentUser,
                        OnBehalfRateLimiter onBehalfRateLimiter, LlmModelFactory llmModelFactory,
                        AgentContext agentContext) {
        this.messagesService = messagesService;
        this.userRepository = userRepository;
        this.userService = userService;
        this.todoTools = todoTools;
        this.noteTools = noteTools;
        this.typeTools = typeTools;
        this.typeItemTools = typeItemTools;
        this.messageTools = messageTools;
        this.inboxTools = inboxTools;
        this.currentUser = currentUser;
        this.onBehalfRateLimiter = onBehalfRateLimiter;
        this.llmModelFactory = llmModelFactory;
        this.agentContext = agentContext;
    }

    public Message generateReply(Long replyingUserId, String recipientUsername) {
        User replyingUser = userRepository.findById(replyingUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if ("CLIENT".equalsIgnoreCase(replyingUser.aiExecutionMode)) {
            return null;
        }

        String provider = replyingUser.llmProvider != null
                ? replyingUser.llmProvider
                : llmModelFactory.defaultProvider();
        Map<String, String> apiKeys = userService.getLlmApiKeys(replyingUser);
        String apiKey = apiKeys.get(provider.toUpperCase());

        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Add your " + provider + " API key in account settings before chatting.");
        }

        List<Message> history = messagesService.findConversation(
                replyingUser.username, recipientUsername, MessageTarget.ASSISTANT);

        List<org.springframework.ai.chat.messages.Message> aiMessages = new ArrayList<>();
        for (Message m : history) {
            if (m.generatedByBot) {
                aiMessages.add(new AssistantMessage(m.msg));
            } else {
                aiMessages.add(new UserMessage(m.msg));
            }
        }

        String basePrompt = replyingUser.systemPrompt != null
                ? replyingUser.systemPrompt
                : "You are a helpful personal assistant with access to the user's todos, notes, and custom items.";

        String systemPrompt = basePrompt + "\n\nToday's date is "
                + java.time.LocalDate.now() + ". Use it to resolve relative dates like "
                + "\"tomorrow\" or \"next Friday\" into ISO-8601 values for tools that take dates."
                + "\n\nIf a request asks for more than one thing, carry out every part of it. "
                + "Make a separate tool call for each action, then confirm what you did. "
                + "Do not stop after the first one, and do not claim something is done "
                + "unless you actually called the tool for it.";

        if (INCLUDE_STATE_BLOCK) {
            systemPrompt = systemPrompt + "\n\n" + agentContext.promptSuffix(replyingUser.username);
        }

        String runId = newRunId();
        ChatModel chatModel = llmModelFactory.build(provider, apiKey, replyingUser.model);

        ActionLog.begin();
        RuntimeException lastToolError = null;
        String reply = null;
        for (int attempt = 1; attempt <= MAX_TOOL_CALL_ATTEMPTS && reply == null; attempt++) {
            try {
                reply = ChatClient.create(chatModel).prompt()
                        .system(systemPrompt)
                        .messages(aiMessages)
                        .tools(todoTools, noteTools, typeTools, typeItemTools, messageTools)
                        .call()
                        .content();
            } catch (RuntimeException e) {
                lastToolError = e;
                log.warn("Agent attempt {}/{} failed for run {} (user {}, provider {}): {}",
                        attempt, MAX_TOOL_CALL_ATTEMPTS, runId, replyingUser.username,
                        provider, e.getMessage());
                // If a tool already wrote something, retrying would repeat the write.
                if (ActionLog.hasAnything() || isFatal(e)) {
                    break;
                }
            }
        }

        List<String> actions = ActionLog.collect();

        if (reply == null) {
            log.error("Agent run {} failed after {} attempts for user {} (provider {}, model {}), {} action(s) completed",
                    runId, MAX_TOOL_CALL_ATTEMPTS, replyingUser.username, provider,
                    replyingUser.model == null ? "default" : replyingUser.model,
                    actions.size(), lastToolError);

            if (!actions.isEmpty()) {
                reply = "I " + String.join(", ", actions)
                        + ". (I had trouble writing my reply, but those changes are saved.)";
            } else {
                String actionable = describeFailure(lastToolError);
                reply = actionable != null
                        ? actionable
                        : "Sorry -- something went wrong on my end and I couldn't complete that. "
                        + "Please try again. (ref " + runId + ")";
            }
        }

        Message replyMessage = new Message();
        User to = new User();
        to.username = recipientUsername;
        replyMessage.to = to;
        replyMessage.target = MessageTarget.ASSISTANT;
        replyMessage.msg = reply.isBlank() ? EMPTY_REPLY_FALLBACK : reply;
        replyMessage.generatedByBot = true;
        return messagesService.send(replyMessage, replyingUserId);
    }

    // Runs when someone messages another user's assistant and that user has auto-reply on.
    // Uses the sender's own API key, stateless, with InboxTools only. Do not add AgentContext
    // or any read tool here: it would expose the recipient's data to a stranger's message.
    public void generateOnBehalfReply(Long senderUserId, User recipient, String messageText) {
        if (!onBehalfRateLimiter.tryAcquire(senderUserId, recipient.id)) {
            return;
        }

        User sender = userRepository.findById(senderUserId).orElse(null);
        if (sender == null) {
            return;
        }

        ChatModel chatModel = buildChatModelOrNull(sender);
        if (chatModel == null) {
            return;
        }

        String runId = newRunId();

        String systemPrompt = "You triage a single incoming message on behalf of its recipient. " +
                "If the message clearly asks for a task or reminder, call add_inbox_todo. If it " +
                "clearly asks for something to be noted or saved, call add_inbox_note. If it is " +
                "ordinary conversation, call no tool at all -- the message is already delivered to " +
                "the recipient as-is. You cannot read or view any of the recipient's existing data, " +
                "and nothing you do here can affect anyone besides the recipient of this one message. " +
                "After using a tool, reply with one short sentence confirming what you filed, written " +
                "for the person who sent the message. Do not speak as the recipient and do not promise " +
                "anything on their behalf -- you are their assistant's intake step, nothing more.";

        currentUser.runAs(recipient.id, recipient.username, sender.username, () -> {
            InboxTools.beginTracking();
            String agentText = null;
            for (int attempt = 1; attempt <= MAX_TOOL_CALL_ATTEMPTS && agentText == null; attempt++) {
                try {
                    agentText = ChatClient.create(chatModel).prompt()
                            .system(systemPrompt)
                            .user(messageText)
                            .tools(inboxTools)
                            .call()
                            .content();
                } catch (RuntimeException e) {
                    log.warn("On-behalf attempt {}/{} failed for run {} (sender {} -> recipient {}): {}",
                            attempt, MAX_TOOL_CALL_ATTEMPTS, runId, sender.username,
                            recipient.username, e.getMessage());
                    if (InboxTools.hasCreatedAnything() && isFatal(e)) {
                        break;
                    }
                }
            }

            List<String> created = InboxTools.collectTracked();

            if (created.isEmpty()) {
                return;
            }

            String confirmationText = (agentText == null || agentText.isBlank())
                    ? "Filed to their inbox: " + String.join("; ", created)
                    : agentText;

            // The model may word the confirmation, but the code chooses the recipient (always the sender).
            Message confirmation = new Message();
            User to = new User();
            to.username = sender.username;
            confirmation.to = to;
            confirmation.target = MessageTarget.ASSISTANT;
            confirmation.msg = truncate(confirmationText);
            confirmation.generatedByBot = true;
            messagesService.send(confirmation, recipient.id);
        });
    }

    private static String newRunId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private String describeFailure(RuntimeException e) {
        String m = e == null || e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        if (m.contains("invalid api key") || m.contains("401") || m.contains("unauthorized")) {
            return "Your API key was rejected by the provider. Check it in account settings.";
        }
        if (m.contains("429") || m.contains("rate limit") || m.contains("quota")
                || m.contains("resource_exhausted")) {
            return "Your AI provider is rate limiting requests right now. Try again shortly.";
        }
        if (m.contains("does not exist") || m.contains("decommission")
                || (m.contains("model") && m.contains("not found"))) {
            return "The model set for your account isn't available from this provider anymore. "
                    + "Pick a different one in settings.";
        }
        return null;
    }

    private String truncate(String text) {
        return text.length() <= 1000 ? text : text.substring(0, 1000 - 3) + "...";
    }

    private boolean isFatal(RuntimeException e) {
        String message = e.getMessage();
        if (message == null) {
            return true;
        }
        String lower = message.toLowerCase();
        return !lower.contains("did not match schema")
                && !lower.contains("tool call validation failed")
                && !lower.contains("failed to call a function");
    }

    private ChatModel buildChatModelOrNull(User user) {
        String provider = user.llmProvider != null
                ? user.llmProvider
                : llmModelFactory.defaultProvider();
        Map<String, String> apiKeys = userService.getLlmApiKeys(user);
        String apiKey = apiKeys.get(provider.toUpperCase());
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }
        return llmModelFactory.build(provider, apiKey, user.model);
    }
}