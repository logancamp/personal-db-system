package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.MessageTarget;
import dev.camp.MyApp.models.types.Message;
import dev.camp.MyApp.security.UserPrincipal;
import dev.camp.MyApp.services.AgentService;
import dev.camp.MyApp.services.MessagesService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/message")
public class MessagesController {
    private final MessagesService messagesService;
    private final AgentService agentService;

    public MessagesController(MessagesService messagesService, AgentService agentService) {
        this.messagesService = messagesService;
        this.agentService = agentService;
    }

    private UserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    @GetMapping
    public List<Message> findAll(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return messagesService.findAllForUser(principal.getUsername());
    }

    @GetMapping("/conversation/{username}")
    public List<Message> findConversation(@PathVariable String username,
                                          @RequestParam(required = false) MessageTarget target,
                                          Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        if (target == null) {
            return messagesService.findConversation(principal.getUsername(), username);
        }
        return messagesService.findConversation(principal.getUsername(), username, target);
    }

    @PostMapping
    public SendMessageResponse send(@RequestBody Message message, Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);

        if (message.to == null || message.to.username == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A recipient username is required.");
        }

        // Self-chat defaults to the assistant. Everything else defaults to PERSON, which never
        // runs an agent, so a client that omits the field can't spend anyone's API budget.
        if (message.target == null) {
            message.target = principal.getUsername().equals(message.to.username)
                    ? MessageTarget.ASSISTANT
                    : MessageTarget.PERSON;
        }

        // Server-controlled fields: callers can't pose as an assistant or pre-mark a message read.
        message.generatedByBot = false;
        message.readAt = null;

        Message sent = messagesService.send(message, principal.getId());

        if (sent.target != MessageTarget.ASSISTANT) {
            return new SendMessageResponse(sent, null);
        }

        if (sent.to.id.equals(sent.from.id)) {
            Message reply = agentService.generateReply(principal.getId(), principal.getUsername());
            return new SendMessageResponse(sent, reply);
        }

        if (sent.to.autoReplyEnabled) {
            agentService.generateOnBehalfReply(principal.getId(), sent.to, sent.msg);
        }
        return new SendMessageResponse(sent, null);
    }

    @GetMapping("/unread")
    public UnreadSummary unread(Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return messagesService.unreadSummary(principal.getUsername());
    }

    @PutMapping("/conversation/{username}/read")
    public ReadResult markRead(@PathVariable String username,
                               @RequestParam(required = false) MessageTarget target,
                               Authentication authentication) {
        UserPrincipal principal = requirePrincipal(authentication);
        return new ReadResult(
                messagesService.markConversationRead(principal.getUsername(), username, target));
    }

    public record ReadResult(int markedRead) {}
}