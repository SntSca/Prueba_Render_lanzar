package com.example.usersbe.exceptions;

public class BlockedUserException extends RuntimeException {
    public BlockedUserException() {
        super("Usuario bloqueado");
    }
}
