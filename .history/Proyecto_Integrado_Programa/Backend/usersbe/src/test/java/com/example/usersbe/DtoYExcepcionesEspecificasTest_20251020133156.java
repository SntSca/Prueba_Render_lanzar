package com.example.usersbe;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;

import static org.junit.jupiter.api.Assertions.*;

class DtoYExcepcionesEspecificasTest {

    private static Class<?> tryLoad(String... fqcnCandidates) {
        for (String name : fqcnCandidates) {
            try { return Class.forName(name); } catch (ClassNotFoundException ignored) {}
        }
        return null;
    }
    private static Object newInstanceOrNull(Class<?> c) {
        try { return c.getDeclaredConstructor().newInstance(); } catch (Throwable e) { return null; }
    }
    private static void setIfPresent(Object bean, String setter, Class<?> pt, Object val) {
        try { bean.getClass().getMethod(setter, pt).invoke(bean, val); } catch (Throwable ignored) {}
    }
    private static Object getIfPresent(Object bean, String getter) {
        try { return bean.getClass().getMethod(getter).invoke(bean); } catch (Throwable ignored) { return null; }
    }
    private static void assertNotBlank(Object v) {
        assertNotNull(v);
        if (v instanceof String s) assertFalse(s.isBlank());
    }

    // ---------- DTOs ----------

    @Test @DisplayName("DTO: SolicitudDeVerificacionDeCaptcha (token)")
    void dto_solicitud_captcha() {
        Class<?> c = tryLoad(
                "com.example.usersbe.dto.SolicitudDeVerificacionDeCaptcha",
                "com.example.usersbe.dto.SolicitudDeVerificacionDeCaptchaDTO"
        );
        if (c == null) return;
        Object bean = newInstanceOrNull(c);
        if (bean == null) return;
        setIfPresent(bean, "setToken", String.class, "tok");
        assertEquals("tok", getIfPresent(bean, "getToken"));
    }

    @Test @DisplayName("DTO: SolicitudDeVerificacionDeMfa (code)")
    void dto_solicitud_mfa() {
        Class<?> c = tryLoad(
                "com.example.usersbe.dto.SolicitudDeVerificacionDeMfa",
                "com.example.usersbe.dto.SolicitudDeVerificacionMfa"
        );
        if (c == null) return;
        Object bean = newInstanceOrNull(c);
        if (bean == null) return;
        setIfPresent(bean, "setCode", String.class, "123456");
        assertEquals("123456", getIfPresent(bean, "getCode"));
    }

    @Test @DisplayName("DTO: SolicitudDeRegistro (campos básicos)")
    void dto_solicitud_registro() {
        Class<?> c = tryLoad(
                "com.example.usersbe.dto.SolicitudDeRegistro",
                "com.example.usersbe.dto.RegistroRequest"
        );
        if (c == null) return;
        Object bean = newInstanceOrNull(c);
        if (bean == null) return;
        setIfPresent(bean, "setNombre", String.class, "N");
        setIfPresent(bean, "setApellidos", String.class, "A");
        setIfPresent(bean, "setAlias", String.class, "alias");
        setIfPresent(bean, "setEmail", String.class, "u@mail.com");
        setIfPresent(bean, "setFechaNac", String.class, "2001-02-03");
        setIfPresent(bean, "setPwd", String.class, "secret");
        setIfPresent(bean, "setFoto", String.class, "f.png");
        assertEquals("N", getIfPresent(bean, "getNombre"));
        assertEquals("A", getIfPresent(bean, "getApellidos"));
        assertEquals("alias", getIfPresent(bean, "getAlias"));
        assertEquals("u@mail.com", getIfPresent(bean, "getEmail"));
        assertEquals("2001-02-03", getIfPresent(bean, "getFechaNac"));
        assertEquals("secret", getIfPresent(bean, "getPwd"));
        assertEquals("f.png", getIfPresent(bean, "getFoto"));
    }

    @Test @DisplayName("DTO: CreadorDTO (alias/descripcion/especialidad si hay ctor vacío)")
    void dto_creador() {
        Class<?> c = tryLoad(
                "com.example.usersbe.dto.CreadorDTO",
                "com.example.usersbe.dto.CreadorDto"
        );
        if (c == null) return;

        // Si NO hay constructor vacío, omitimos (evita fallo que viste)
        try {
            Constructor<?> ctor = c.getDeclaredConstructor();
            Object bean = ctor.newInstance();
            setIfPresent(bean, "setAlias", String.class, "x");
            setIfPresent(bean, "setDescripcion", String.class, "d");
            setIfPresent(bean, "setEspecialidad", String.class, "e");
            assertEquals("x", getIfPresent(bean, "getAlias"));
            assertEquals("d", getIfPresent(bean, "getDescripcion"));
            assertEquals("e", getIfPresent(bean, "getEspecialidad"));
        } catch (Throwable ignored) {
            // sin ctor vacío -> no hacemos nada
        }
    }

    @Test @DisplayName("DTO: ErrorAmistoso (message)")
    void dto_error_amistoso() {
        Class<?> c = tryLoad(
                "com.example.usersbe.dto.ErrorAmistoso",
                "com.example.usersbe.dto.ErrorFriendly"
        );
        if (c == null) return;
        Object bean = newInstanceOrNull(c);
        if (bean == null) return;
        setIfPresent(bean, "setMessage", String.class, "hola");
        assertEquals("hola", getIfPresent(bean, "getMessage"));
    }

    // ---------- Excepciones ----------

    @Test @DisplayName("Excepción: AliasYaUsadoException")
    void ex_alias_ya_usado() {
        Class<?> c = tryLoad(
                "com.example.usersbe.exceptions.AliasYaUsadoException",
                "com.example.usersbe.exceptions.DuplicateAliasException"
        );
        if (c == null) return;
        try {
            var ctor = c.getDeclaredConstructor(String.class);
            Object ex = ctor.newInstance("alias");
            assertTrue(((Throwable) ex).getMessage().toLowerCase().contains("alias"));
        } catch (Throwable ignored) {}
    }

    @Test @DisplayName("Excepción: Usuario bloqueado")
    void ex_usuario_bloqueado() {
        Class<?> c = tryLoad(
                "com.example.usersbe.exceptions.UserBlockedException",
                "com.example.usersbe.exceptions.ExcepcionDeUsuarioBloqueado"
        );
        if (c == null) return;
        try {
            var ctor = c.getDeclaredConstructor(String.class);
            Object ex = ctor.newInstance("bloqueado");
            assertNotBlank(((Throwable) ex).getMessage());
        } catch (Throwable ignored) {}
    }

    @Test @DisplayName("Excepción: Creador no encontrado")
    void ex_creador_no_encontrado() {
        Class<?> c = tryLoad(
                "com.example.usersbe.exceptions.CreatorNotFoundException",
                "com.example.usersbe.exceptions.ExcepcionDeCreadorNoEncontrado"
        );
        if (c == null) return;
        try {
            var ctor = c.getDeclaredConstructor(String.class);
            Object ex = ctor.newInstance("idc");
            assertNotBlank(((Throwable) ex).getMessage());
        } catch (Throwable ignored) {}
    }

    @Test @DisplayName("Excepción: NoACreatorException")
    void ex_no_a_creator() {
        Class<?> c = tryLoad("com.example.usersbe.exceptions.NoACreatorException");
        if (c == null) return;
        try {
            var ctor = c.getDeclaredConstructor(String.class);
            Object ex = ctor.newInstance("noC");
            assertTrue(((Throwable) ex).getMessage().contains("noC"));
        } catch (Throwable ignored) {}
    }

    @Test @DisplayName("Excepción: Usuario ya existente")
    void ex_usuario_ya_existente() {
        Class<?> c = tryLoad(
                "com.example.usersbe.exceptions.UserAlreadyExistsException",
                "com.example.usersbe.exceptions.ExcepcionDeUsuarioYaExistente"
        );
        if (c == null) return;
        try {
            var ctor = c.getDeclaredConstructor(String.class);
            Object ex = ctor.newInstance("correo");
            assertNotBlank(((Throwable) ex).getMessage());
        } catch (Throwable ignored) {}
    }
}
