package com.example.usersbe.exceptions;

public class UserAlreadyExistsException extends RuntimeException {
    public UserAlreadyExistsException(String email) {
        super("El usuario ya existe: " + email);
    }
    
}
