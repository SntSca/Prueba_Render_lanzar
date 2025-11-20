package com.example.usersbe.http;

import com.example.usersbe.exceptions.BlockedUserException;
import com.example.usersbe.exceptions.InvalidCredentialsException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleInvalid(InvalidCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "Problema al intentar acceder a la plataforma, por favor comuníquese con un administrador."));
    }

    @ExceptionHandler(BlockedUserException.class)
    public ResponseEntity<Map<String, String>> handleBlocked(BlockedUserException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", "Usuario bloqueado"));
    }
}

