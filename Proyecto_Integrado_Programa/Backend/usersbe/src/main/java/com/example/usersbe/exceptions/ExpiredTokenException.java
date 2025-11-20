package com.example.usersbe.exceptions;

public class ExpiredTokenException extends RuntimeException {
    public ExpiredTokenException(String token) {
        super("Token expirado: " + token);
    }
}
