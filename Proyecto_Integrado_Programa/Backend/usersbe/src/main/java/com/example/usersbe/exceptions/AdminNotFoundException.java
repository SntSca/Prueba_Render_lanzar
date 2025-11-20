package com.example.usersbe.exceptions;

public class AdminNotFoundException extends RuntimeException {
    public AdminNotFoundException(String id) { super("Administrador no encontrado: " + id); }
}
