package com.example.usersbe;

import com.example.usersbe.dto.RegisterRequest;
import com.example.usersbe.model.User;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RegisterAndFriendlyDtoTest {

    @Test
    void registerRequest_getters_setters() {
        RegisterRequest r = new RegisterRequest();
        r.setNombre("N");
        r.setApellidos("A");
        r.setAlias("alias");
        r.setEmail("e@mail.com");
        r.setFechaNac(LocalDate.of(2001, 2, 3));
        r.setPwd("secret");
        r.setVip(true);
        r.setFoto("foto.png");
        r.setRole(User.Role.USUARIO);

        assertEquals("N", r.getNombre());
        assertEquals("A", r.getApellidos());
        assertEquals("alias", r.getAlias());
        assertEquals("e@mail.com", r.getEmail());
        assertEquals(LocalDate.of(2001, 2, 3), r.getFechaNac());
        assertEquals("secret", r.getPwd());
        assertTrue(r.isVip());
        assertEquals("foto.png", r.getFoto());
        assertEquals(User.Role.USUARIO, r.getRole());
    }

    @Test
    void friendlyError_msg_attempts_waitFor() {
        Map<String, Object> m1 = FriendlyError.msg("hola");
        assertEquals(false, m1.get("ok"));
        assertEquals("hola", m1.get("message"));

        Map<String, Object> m2 = FriendlyError.attempts("limite", 2);
        assertEquals(false, m2.get("ok"));
        assertEquals("limite", m2.get("message"));
        assertEquals(2, m2.get("attemptsLeft"));

        Map<String, Object> m3 = FriendlyError.waitFor("espera", 15L);
        assertEquals(false, m3.get("ok"));
        assertEquals("espera", m3.get("message"));
        assertEquals(15L, m3.get("waitSeconds"));
    }

    @Test
    void creadorDTO_builder_sets_all_fields() {
        Instant now = Instant.now();
        CreadorDTO dto = new CreadorDTO.Builder()
                .id("id1")
                .alias("al")
                .nombre("Nombre")
                .email("e@mail.com")
                .blocked(true)
                .deleted(false)
                .createdAt(now)
                .fotoUrl("u.png")
                .bio("bio")
                .build();

        assertEquals("id1", dto.id);
        assertEquals("al", dto.alias);
        assertEquals("Nombre", dto.nombre);
        assertEquals("e@mail.com", dto.email);
        assertTrue(dto.blocked);
        assertFalse(dto.deleted);
        assertEquals(now, dto.createdAt);
        assertEquals("u.png", dto.fotoUrl);
        assertEquals("bio", dto.bio);
    }
}