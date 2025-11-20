package com.example.usersbe;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.DuplicateAliasException;
import com.example.usersbe.exceptions.InvalidRoleException;
import com.example.usersbe.exceptions.UserDeletionNotAllowedException;
import com.example.usersbe.exceptions.UserNotFoundException;
import com.example.usersbe.model.User;
import com.example.usersbe.services.UserService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserServiceUsuariosTest {

    @Mock
    private UserDao userDao;

    @InjectMocks
    private UserService userService;

    private User u;

    @BeforeEach
    void init() {
        u = user("u1", "user1", "User", "One", "USER1@MAIL.COM", "foto.png",
                 User.Role.USUARIO, false);
        u.setFechaNac(LocalDate.of(2000, 1, 1));
    }

    @Test
    @DisplayName("actualizarUsuario: actualiza alias/nombre/apellidos/foto y fechaNac, sin tocar email")
    void actualizarUsuario_ok() {
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User res = userService.actualizarUsuario(
                "u1",
                "  nuevo ",
                "  Nombre ",
                " Apellidos ",
                null,
                " avatar.png ",
                "2001-05-09"
        );

        assertEquals("nuevo", res.getAlias());
        assertEquals("Nombre", res.getNombre());
        assertEquals("Apellidos", res.getApellidos());
        assertEquals("USER1@MAIL.COM", res.getEmail());
        assertEquals(" avatar.png ", res.getFoto());
        assertEquals(LocalDate.of(2001, 5, 9), res.getFechaNac());
    }

    @Test
    @DisplayName("actualizarUsuario: not found")
    void actualizarUsuario_notFound() {
        when(userDao.findById("x")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class,
                () -> userService.actualizarUsuario("x", null, null, null, null, null, null));
    }

    @Test
    @DisplayName("actualizarUsuario: rol inválido (no es USUARIO)")
    void actualizarUsuario_rolInvalido() {
        User otro = user("c1", "crea", "C", "R", "c@mail.com", "f.png",
                         User.Role.GESTOR_CONTENIDO, false);
        when(userDao.findById("c1")).thenReturn(Optional.of(otro));
        assertThrows(InvalidRoleException.class,
                () -> userService.actualizarUsuario("c1", null, null, null, null, null, null));
    }

    @Test
    @DisplayName("actualizarUsuario: alias duplicado")
    void actualizarUsuario_aliasDuplicado() {
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        User otro = user("u2", "dup", "X", "Y", "x@mail.com", "f.png",
                         User.Role.USUARIO, false);

        // === ELIGE SOLO UNA DE LAS VARIANTES SEGÚN TU DAO ===

        // Variante A — Spring Data típica con filtro por id:
        // existsByAliasIgnoreCaseAndIdNot(String alias, String id)
        when(userDao.existsByAliasIgnoreCaseAndIdNot("dup", "u1")).thenReturn(true);

        // Variante B — Simple: existsByAliasIgnoreCase(String alias)
        // when(userDao.existsByAliasIgnoreCase("dup")).thenReturn(true);

        // Variante C — findByAlias[IgnoreCase](String alias) y comparar id
        // (si devuelve Optional<User>):
        // when(userDao.findByAliasIgnoreCase("dup")).thenReturn(Optional.of(otro));
        // (si devuelve User directamente):
        // when(userDao.findByAliasIgnoreCase("dup")).thenReturn(otro);
        // o bien:
        // when(userDao.findByAlias("dup")).thenReturn(otro);

        assertThrows(DuplicateAliasException.class,
                () -> userService.actualizarUsuario("u1", "dup", null, null, null, null, null));
    }

    @Test
    @DisplayName("bloquearUsuario: bloquea si estaba desbloqueado")
    void bloquearUsuario_cambia() {
        u.setBlocked(false);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User res = userService.bloquearUsuario("u1");
        assertTrue(res.isBlocked());
        verify(userDao).save(any(User.class));
    }

    @Test
    @DisplayName("bloquearUsuario: idempotente si ya estaba bloqueado")
    void bloquearUsuario_idempotente() {
        u.setBlocked(true);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        User res = userService.bloquearUsuario("u1");
        assertTrue(res.isBlocked());
        verify(userDao, never()).save(any());
    }

    @Test
    @DisplayName("desbloquearUsuario: desbloquea si estaba bloqueado")
    void desbloquearUsuario_cambia() {
        u.setBlocked(true);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User res = userService.desbloquearUsuario("u1");
        assertFalse(res.isBlocked());
        verify(userDao).save(any(User.class));
    }

    @Test
    @DisplayName("desbloquearUsuario: idempotente si ya estaba desbloqueado")
    void desbloquearUsuario_idempotente() {
        u.setBlocked(false);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        User res = userService.desbloquearUsuario("u1");
        assertFalse(res.isBlocked());
        verify(userDao, never()).save(any());
    }

    @Test
    @DisplayName("eliminarUsuario: prohibido si existe (UserDeletionNotAllowedException)")
    void eliminarUsuario_prohibido() {
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        assertThrows(UserDeletionNotAllowedException.class,
                () -> userService.eliminarUsuario("u1"));
        verify(userDao, never()).deleteById(anyString());
    }

    @Test
    @DisplayName("eliminarUsuario: not found")
    void eliminarUsuario_notFound() {
        when(userDao.findById("no")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class,
                () -> userService.eliminarUsuario("no"));
    }

    private static User user(String id, String alias, String nombre, String apellidos,
                             String email, String foto, User.Role role, boolean blocked) {
        User u = new User();
        u.setId(id);
        u.setAlias(alias);
        u.setNombre(nombre);
        u.setApellidos(apellidos);
        u.setEmail(email);
        u.setFoto(foto);
        u.setRole(role);
        u.setBlocked(blocked);
        return u;
    }
}
