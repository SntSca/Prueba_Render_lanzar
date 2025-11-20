package com.example.usersbe.exceptions;

public class AliasAlreadyUsedException extends RuntimeException {
    public AliasAlreadyUsedException() { super("El alias ya está en uso"); }
}
