package com.example.usersbe;

import com.example.usersbe.dto.*;
import com.example.usersbe.exceptions.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DtoAndExceptionsSmokeTest {

    @Test
    @DisplayName("DTOs: getters/setters básicos")
    void dtos_smoke() {
        SolicitudDeRegistro sr = new SolicitudDeRegistro();
        sr.setNombre("n");
        sr.setApellidos("a");
        sr.setAlias("al");
        sr.setEmail("e@mail.com");
        sr.setFechaNac("2000-01-01");
        sr.setPwd("p");
        sr.setFoto("f");
        assertEquals("n", sr.getNombre());
        assertEquals("a", sr.getApellidos());
        assertEquals("al", sr.getAlias());
        assertEquals("e@mail.com", sr.getEmail());
        assertEquals("2000-01-01", sr.getFechaNac());
        assertEquals("p", sr.getPwd());
        assertEquals("f", sr.getFoto());

        SolicitudDeCreacionDeAdministrador sa = new SolicitudDeCreacionDeAdministrador();
        sa.setDepartamento("IT");
        assertEquals("IT", sa.getDepartamento());

        CreadorDTO cdto = new CreadorDTO();
        cdto.setAlias("x");
        cdto.setDescripcion("d");
        cdto.setEspecialidad("e");
        assertEquals("x", cdto.getAlias());
        assertEquals("d", cdto.getDescripcion());
        assertEquals("e", cdto.getEspecialidad());

        SolicitudDeInicioDeSesion login = new SolicitudDeInicioDeSesion();
        login.setEmail("u@mail.com");
        login.setPwd("p");
        assertEquals("u@mail.com", login.getEmail());
        assertEquals("p", login.getPwd());

        RespuestaDeInicioDeSesion rlogin = new RespuestaDeInicioDeSesion();
        rlogin.setToken("t");
        assertEquals("t", rlogin.getToken());

        SolicitudDeVerificacionDeCaptcha cap = new SolicitudDeVerificacionDeCaptcha();
        cap.setToken("tok");
        assertEquals("tok", cap.getToken());

        SolicitudDeVerificacionDeMfa mfa = new SolicitudDeVerificacionDeMfa();
        mfa.setCode("123456");
        assertEquals("123456", mfa.getCode());

        ErrorAmistoso ea = new ErrorAmistoso();
        ea.setMessage("m");
        assertEquals("m", ea.getMessage());
    }

    @Test
    @DisplayName("Excepciones: construcción y mensaje")
    void exceptions_smoke() {
        assertEquals("dup", new DuplicateAliasException("dup").getMessage());
        assertEquals("inval", new InvalidRoleException("inval").getMessage());
        assertEquals("no", new UserNotFoundException("no").getMessage());
        assertEquals("del", new UserDeletionNotAllowedException("del").getMessage());
        assertEquals("block", new UserBlockedException("block").getMessage());
        assertEquals("login", new InvalidCredentialsException("login").getMessage());
        assertEquals("email", new InvalidEmailException("email").getMessage());
        assertEquals("camp", new InvalidFieldException("camp").getMessage());
        assertEquals("dupEmail", new DuplicateEmailException("dupEmail").getMessage());
        assertEquals("dupEmail2", new EmailAlreadyUsedException("dupEmail2").getMessage());
        assertEquals("val", new ValidationException("val").getMessage());
        assertEquals("noC", new NoACreatorException("noC").getMessage());
        assertEquals("elim", new UserDeletionNotAllowedException("elim").getMessage());
        assertEquals("faltaconfig", new MissingSuperAdminEmailConfigException().getMessage());
    }
}
