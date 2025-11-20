package com.example.usersbe;

import org.junit.jupiter.api.Test;

import com.example.usersbe.exceptions.AdminNotFoundException;
import com.example.usersbe.exceptions.EmailSendException;
import com.example.usersbe.exceptions.ExpiredTokenException;
import com.example.usersbe.exceptions.ForbiddenException;
import com.example.usersbe.exceptions.InvalidPasswordException;
import com.example.usersbe.exceptions.InvalidRoleException;
import com.example.usersbe.exceptions.InvalidTokenException;
import com.example.usersbe.exceptions.MissingSuperAdminEmailConfigException;
import com.example.usersbe.exceptions.NotAnAdminException;
import com.example.usersbe.exceptions.SuperAdminProtectionException;
import com.example.usersbe.exceptions.UserDeletionNotAllowedException;
import com.example.usersbe.exceptions.UserNotFoundException;

import static org.junit.jupiter.api.Assertions.*;

class ServiceExceptionsSmokeTest {

    @Test
    void exceptions_have_messages() {
        assertEquals("adminNF", new AdminNotFoundException("adminNF").getMessage());
        assertEquals("send", new EmailSendException("send", new RuntimeException()).getMessage());
        assertEquals("expired", new ExpiredTokenException("expired").getMessage());
        assertEquals("forb", new ForbiddenException("forb").getMessage());
        assertEquals("pwd", new InvalidPasswordException("pwd").getMessage());
        assertEquals("role", new InvalidRoleException("role").getMessage());
        assertEquals("tok", new InvalidTokenException("tok").getMessage());
        assertNotNull(new MissingSuperAdminEmailConfigException().getMessage());
        assertEquals("notAdmin", new NotAnAdminException().getMessage());
        assertEquals("prot", new SuperAdminProtectionException("prot").getMessage());
        assertEquals("del", new UserDeletionNotAllowedException("del").getMessage());
        assertEquals("userNF", new UserNotFoundException("userNF").getMessage());
    }
}