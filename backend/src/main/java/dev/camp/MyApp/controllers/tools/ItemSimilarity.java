package dev.camp.MyApp.controllers.tools;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

// Cheap duplicate check: token containment first, Jaccard overlap as the fallback.
public final class ItemSimilarity {
    private static final double JACCARD_THRESHOLD = 0.6;

    private static final int MIN_TOKENS_FOR_CONTAINMENT = 2;

    private ItemSimilarity() {
    }

    public static boolean looksLikeDuplicate(String a, String b) {
        Set<String> ta = tokens(a);
        Set<String> tb = tokens(b);
        if (ta.isEmpty() || tb.isEmpty()) {
            return false;
        }

        int smaller = Math.min(ta.size(), tb.size());
        if (smaller >= MIN_TOKENS_FOR_CONTAINMENT && (ta.containsAll(tb) || tb.containsAll(ta))) {
            return true;
        }

        Set<String> shared = new HashSet<>(ta);
        shared.retainAll(tb);
        Set<String> combined = new HashSet<>(ta);
        combined.addAll(tb);
        return (double) shared.size() / combined.size() >= JACCARD_THRESHOLD;
    }

    private static Set<String> tokens(String s) {
        if (s == null) {
            return Set.of();
        }
        return Arrays.stream(s.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
                .filter(t -> !t.isBlank())
                .collect(Collectors.toSet());
    }
}