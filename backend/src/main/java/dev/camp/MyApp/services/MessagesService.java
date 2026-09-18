package dev.camp.MyApp.services;

import dev.camp.MyApp.controllers.UnreadSummary;
import dev.camp.MyApp.models.MessageRepository;
import dev.camp.MyApp.models.MessageTarget;
import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.models.types.Message;
import dev.camp.MyApp.models.types.User;
import org.jspecify.annotations.NonNull;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MessagesService {
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    public MessagesService(MessageRepository messageRepository, UserRepository userRepository) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    public List<Message> findConversation(String userA, String userB) {
        return messageRepository.findAllByFrom_UsernameAndTo_UsernameOrFrom_UsernameAndTo_UsernameOrderByIdAsc(
                userA, userB, userB, userA);
    }

    public List<Message> findConversation(String userA, String userB, MessageTarget target) {
        return messageRepository
                .findAllByFrom_UsernameAndTo_UsernameAndTargetOrFrom_UsernameAndTo_UsernameAndTargetOrderByIdAsc(
                        userA, userB, target,
                        userB, userA, target);
    }

    public Message send(Message message, Long fromUserId) {
        User toUser = userRepository.findByUsername(message.to.username);
        if (toUser == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found.");
        }

        User fromUser = userRepository.findById(fromUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        message.id = 0;
        message.createdAt = LocalDateTime.now();
        message.from = fromUser;
        message.to = toUser;

        if (message.target == null) {
            message.target = MessageTarget.PERSON;
        }

        if (message.to.id.equals(fromUserId) && !message.generatedByBot) {
            message.readAt = message.createdAt;
        }

        return messageRepository.save(message);
    }

    public List<Message> findAllForUser(String username) {
        return messageRepository.findAllByToUsernameOrderByIdAsc(username);
    }

    public UnreadSummary unreadSummary(String username) {
        List<Message> unread = messageRepository.findAllByTo_UsernameAndReadAtIsNullOrderByIdAsc(username);

        Map<String, UnreadSummary.ConversationUnread> grouped = createGrouped(unread);

        List<UnreadSummary.ConversationUnread> conversations = new ArrayList<>(grouped.values());
        conversations.sort(Comparator.comparing(
                UnreadSummary.ConversationUnread::latestAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        return new UnreadSummary(unread.size(), conversations);
    }

    private static @NonNull Map<String, UnreadSummary.ConversationUnread> createGrouped(List<Message> unread) {
        Map<String, UnreadSummary.ConversationUnread> grouped = new LinkedHashMap<>();
        for (Message m : unread) {
            String other = m.from.username;
            String key = other + "|" + m.target;
            UnreadSummary.ConversationUnread existing = grouped.get(key);
            if (existing == null) {
                grouped.put(key, new UnreadSummary.ConversationUnread(other, m.target, 1, m.createdAt));
            } else {
                LocalDateTime latest = m.createdAt != null && m.createdAt.isAfter(existing.latestAt())
                        ? m.createdAt : existing.latestAt();
                grouped.put(key, new UnreadSummary.ConversationUnread(
                        other, m.target, existing.count() + 1, latest));
            }
        }
        return grouped;
    }

    @Transactional
    public int markConversationRead(String username, String otherUsername, MessageTarget target) {
        List<Message> unread = target == null
                ? messageRepository.findAllByTo_UsernameAndFrom_UsernameAndReadAtIsNullOrderByIdAsc(
                        username, otherUsername)
                : messageRepository.findAllByTo_UsernameAndFrom_UsernameAndTargetAndReadAtIsNullOrderByIdAsc(
                        username, otherUsername, target);

        LocalDateTime now = LocalDateTime.now();
        for (Message m : unread) {
            m.readAt = now;
        }
        messageRepository.saveAll(unread);
        return unread.size();
    }
}