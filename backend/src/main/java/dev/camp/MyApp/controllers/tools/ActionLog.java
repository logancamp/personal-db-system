package dev.camp.MyApp.controllers.tools;

import java.util.ArrayList;
import java.util.List;

public final class ActionLog {
    private static final ThreadLocal<List<String>> ACTIONS = ThreadLocal.withInitial(ArrayList::new);

    private ActionLog() {
    }

    public static void begin() {
        ACTIONS.get().clear();
    }

    public static void record(String description) {
        ACTIONS.get().add(description);
    }

    public static boolean hasAnything() {
        return !ACTIONS.get().isEmpty();
    }

    public static List<String> collect() {
        List<String> copy = List.copyOf(ACTIONS.get());
        ACTIONS.remove();
        return copy;
    }
}