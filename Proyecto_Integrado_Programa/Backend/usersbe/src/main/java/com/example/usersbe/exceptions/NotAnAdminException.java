package com.example.usersbe.exceptions;

public class NotAnAdminException extends RuntimeException {
    public NotAnAdminException() { super("El usuario indicado no es un administrador"); }
}
