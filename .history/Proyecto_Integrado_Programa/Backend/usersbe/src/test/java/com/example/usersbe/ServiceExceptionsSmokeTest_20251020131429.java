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

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ServiceExceptionsSmokeTest {

    @Test
    void exceptions_have_messages() {
        // Mensajes que incluyen el dato pasado
        assertTrue(new AdminNotFoundException("adminNF").getMessage().contains("adminNF"));
        assertTrue(new EmailSendException("send", new RuntimeException()).getMessage().contains("send"));
        assertTrue(new ExpiredTokenException("expired").getMessage().contains("expired"));
        assertTrue(new ForbiddenException("forb").getMessage().contains("forb"));
        assertTrue(new InvalidPasswordException("pwd").getMessage().contains("pwd"));
        assertTrue(new InvalidRoleException("role").getMessage().contains("role"));
        assertTrue(new InvalidTokenException("tok").getMessage().contains("tok"));
        assertTrue(new SuperAdminProtectionException("prot").getMessage().contains("prot"));
        assertTrue(new UserDeletionNotAllowedException("del").getMessage().contains("del"));
        assertTrue(new UserNotFoundException("userNF").getMessage().contains("userNF"));

        // Mensaje fijo / sin parámetro: solo comprobamos que no esté vacío
        String msg = new MissingSuperAdminEmailConfigException().getMessage();
        assertNotNull(msg);
        assertFalse(msg.isBlank());
    }
}