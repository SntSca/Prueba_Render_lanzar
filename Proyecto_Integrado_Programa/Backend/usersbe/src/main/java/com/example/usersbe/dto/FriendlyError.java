package com.example.usersbe.dto;

import java.util.Map;

public final class FriendlyError {
    private FriendlyError() {}
    private static final String MESSAGE_KEY = "message";

    public static Map<String, Object> msg(String message) {
        return Map.of("ok", false, MESSAGE_KEY, message);
    }

    public static Map<String, Object> attempts(String message, int attemptsLeft) {
        return Map.of("ok", false, MESSAGE_KEY, message, "attemptsLeft", attemptsLeft);
    }

    public static Map<String, Object> waitFor(String message, long waitSeconds) {
        return Map.of("ok", false, MESSAGE_KEY, message, "waitSeconds", waitSeconds);
    }
}
