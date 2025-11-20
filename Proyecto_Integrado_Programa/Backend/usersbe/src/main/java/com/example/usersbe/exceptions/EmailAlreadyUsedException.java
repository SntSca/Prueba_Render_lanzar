package com.example.usersbe.exceptions;

public class EmailAlreadyUsedException extends RuntimeException {
    public EmailAlreadyUsedException() { super("El email ya está en uso"); }
}
