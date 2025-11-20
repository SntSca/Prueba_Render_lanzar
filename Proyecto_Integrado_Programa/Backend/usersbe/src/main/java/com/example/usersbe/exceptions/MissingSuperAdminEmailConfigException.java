package com.example.usersbe.exceptions;

public class MissingSuperAdminEmailConfigException extends RuntimeException {
    public MissingSuperAdminEmailConfigException() {
        super("Configura app.superadmin.email");
    }
}
