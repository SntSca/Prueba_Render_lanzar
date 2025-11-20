package com.example.usersbe.exceptions;

public class InvalidTokenException extends RuntimeException {
    public InvalidTokenException(String token) {
        super("Token inválido o caducado: " + token);
    }
}
