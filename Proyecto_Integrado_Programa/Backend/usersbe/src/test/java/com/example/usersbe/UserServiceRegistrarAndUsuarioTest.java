package com.example.usersbe;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.InvalidRoleException;
import com.example.usersbe.exceptions.UserNotFoundException;
import com.example.usersbe.model.User;
import com.example.usersbe.services.EmailService;
import com.example.usersbe.services.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceRegistrarAndUsuarioTest {

    @Mock UserDao userDao;
    @Mock EmailService emailService;
    @InjectMocks UserService userService;

    private static User u(String id, User.Role r) {
        User u = new User();
        u.setId(id);
        u.setEmail("old@mail.com");
        u.setRole(r);
        return u;
    }

    @Test
    @DisplayName("registrar: ADMINISTRADOR normaliza email y fija departamento")
    void registrar_admin_ok() {
        ArgumentCaptor<User> cap = ArgumentCaptor.forClass(User.class);
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.registrar(
                " Nombre ", " Ap ", " alias ", " ADMIN@MAIL.com ", "1990-12-31",
                "pwd-123456", false, "f.png", User.Role.ADMINISTRADOR,
                null, null, null, "  Sistemas  "
        );

        verify(userDao).save(cap.capture());
        User saved = cap.getValue();
        assertEquals("nombre", saved.getNombre().toLowerCase());
        assertEquals("ap", saved.getApellidos().toLowerCase());
        assertEquals("alias", saved.getAlias());
        assertEquals("admin@mail.com", saved.getEmail());
        assertEquals(User.Role.ADMINISTRADOR, saved.getRole());
        assertEquals("Sistemas", saved.getDepartamento());
        assertEquals(LocalDate.parse("1990-12-31"), saved.getFechaNac());
        assertNotNull(saved.getPwd());
    }

    @Test
    @DisplayName("actualizarUsuario: normaliza email, aplica fecha y guarda")
    void actualizarUsuario_normalizaYGuarda() {
        User user = u("u1", User.Role.USUARIO);
        when(userDao.findById("u1")).thenReturn(Optional.of(user));
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User res = userService.actualizarUsuario(
                "u1",
                "  nuevoAlias ",
                "  Nom ",
                " Ape ",
                " NEW@MAIL.COM ",
                " foto.png ",
                "2000-01-02"
        );

        assertEquals("nuevoAlias", res.getAlias());
        assertEquals("Nom", res.getNombre());
        assertEquals("Ape", res.getApellidos());
        assertEquals("new@mail.com", res.getEmail());
        assertEquals(" foto.png ", res.getFoto());
        assertEquals(LocalDate.of(2000,1,2), res.getFechaNac());
        verify(userDao).save(any(User.class));
    }

    @Test
    @DisplayName("actualizarUsuario: not found y rol inválido")
    void actualizarUsuario_notFoundYRol() {
        when(userDao.findById("x")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class,
                () -> userService.actualizarUsuario("x", null, null, null, null, null, null));

        User admin = u("a1", User.Role.ADMINISTRADOR);
        when(userDao.findById("a1")).thenReturn(Optional.of(admin));
        assertThrows(InvalidRoleException.class,
                () -> userService.actualizarUsuario("a1", null, null, null, null, null, null));
    }
}
