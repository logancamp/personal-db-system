package dev.camp.MyApp.controllers.tools;

import dev.camp.MyApp.models.types.Message;
import dev.camp.MyApp.models.types.User;
import dev.camp.MyApp.services.MessagesService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MessageTools {
    private final MessagesService messagesService;
    private final CurrentUser currentUser;

    public MessageTools(MessagesService messagesService, CurrentUser currentUser) {
        this.messagesService = messagesService;
        this.currentUser = currentUser;
    }

    @Tool(name = "list_messages", description = "List messages sent TO the caller, optionally filtered by sender. Use get_conversation instead when you need both sides of an exchange.")
    public List<Message> listMessages(
            @ToolParam(description = "Username to filter by, or \"all\" for every message", required = true) String fromUsername) {
        List<Message> messages = messagesService.findAllForUser(currentUser.username());
        if (fromUsername == null || fromUsername.isBlank() || "all".equalsIgnoreCase(fromUsername)) {
            return messages;
        }
        return messages.stream()
                .filter(m -> m.from != null && fromUsername.equalsIgnoreCase(m.from.username))
                .toList();
    }

    @Tool(name = "get_conversation", description = "Get the full two-way conversation between the caller and another user, oldest first. Use this for summarising or recalling an exchange, since it includes both sent and received messages.")
    public List<Message> getConversation(
            @ToolParam(description = "The other user's username", required = true) String withUsername) {
        return messagesService.findConversation(currentUser.username(), withUsername);
    }

    @Tool(name = "send_message", description = "Send a secure message from the caller to another user")
    public void sendMessage(
            @ToolParam(description = "Username receiving the message", required = true) String toUsername,
            @ToolParam(description = "Message content", required = true) String content) {
        Message message = new Message();
        User to = new User();
        to.username = toUsername;
        message.to = to;
        message.msg = content;
        messagesService.send(message, currentUser.id());
    }
}