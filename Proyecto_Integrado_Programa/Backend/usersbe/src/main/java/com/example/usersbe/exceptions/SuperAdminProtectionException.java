package com.example.usersbe.exceptions;

public class SuperAdminProtectionException extends RuntimeException {
    public SuperAdminProtectionException(String action) {
        super("No se puede " + action + " al superAdmin");
    }
}
