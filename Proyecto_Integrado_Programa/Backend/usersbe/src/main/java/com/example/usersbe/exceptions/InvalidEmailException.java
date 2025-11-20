package com.example.usersbe.exceptions;

public class InvalidEmailException extends RuntimeException {
    public InvalidEmailException(String email) {
        super("Dirección de correo inválida: " + email);
    }
}
