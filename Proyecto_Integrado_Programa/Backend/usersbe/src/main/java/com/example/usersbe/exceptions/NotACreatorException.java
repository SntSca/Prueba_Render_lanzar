package com.example.usersbe.exceptions;

public class NotACreatorException extends RuntimeException {
    public NotACreatorException() { super("El usuario indicado no es un creador"); }
}
