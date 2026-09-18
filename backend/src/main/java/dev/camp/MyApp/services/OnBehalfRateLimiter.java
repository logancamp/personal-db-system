package dev.camp.MyApp.services;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
public class OnBehalfRateLimiter {
    private static final int MAX_TRIGGERS_PER_WINDOW = 5;
    private static final long WINDOW_MINUTES = 60;

    private final ConcurrentHashMap<String, Deque<Instant>> recentTriggers = new ConcurrentHashMap<>();

    public boolean tryAcquire(Long senderId, Long recipientId) {
        String key = senderId + "->" + recipientId;
        Instant cutoff = Instant.now().minus(WINDOW_MINUTES, ChronoUnit.MINUTES);

        Deque<Instant> timestamps = recentTriggers.computeIfAbsent(key, k -> new ConcurrentLinkedDeque<>());

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= MAX_TRIGGERS_PER_WINDOW) {
                return false;
            }
            timestamps.addLast(Instant.now());
            return true;
        }
    }
}