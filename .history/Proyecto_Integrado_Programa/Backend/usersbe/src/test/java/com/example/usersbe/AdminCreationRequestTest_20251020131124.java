package com.example.usersbe.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AdminCreationRequestTest {

    @Test
    void getters_setters() {
        AdminCreationRequest req = new AdminCreationRequest();
        req.setNombre("Ana");
        req.setApellidos("Admin");
        req.setAlias("root");
        req.setEmail("ROOT@MAIL.COM");
        req.setFechaNac("1999-05-06");
        req.setPwd("secret");
        req.setFoto("f.png");
        req.setDepartamento("IT");

        assertEquals("Ana", req.getNombre());
        assertEquals("Admin", req.getApellidos());
        assertEquals("root", req.getAlias());
        assertEquals("ROOT@MAIL.COM", req.getEmail());
        assertEquals("1999-05-06", req.getFechaNac());
        assertEquals("secret", req.getPwd());
        assertEquals("f.png", req.getFoto());
        assertEquals("IT", req.getDepartamento());
    }
}
