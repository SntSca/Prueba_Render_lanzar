package com.example.usersbe;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.dto.AdminCreationRequest;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceAdminCreationTest {

    @Mock UserDao userDao;
    @Mock EmailService emailService;
    @InjectMocks UserService userService;

    @Test
    @DisplayName("solicitarCreacionAdmin: construye y guarda con campos normalizados")
    void solicitarCreacionAdmin_ok() {
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminCreationRequest req = new AdminCreationRequest();
        req.setNombre("  Ana ");
        req.setApellidos("  Admin ");
        req.setAlias("  root  ");
        req.setEmail(" ROOT@MAIL.COM ");
        req.setFechaNac("1999-05-06");
        req.setPwd("admin-pass");
        req.setFoto("f.png");
        req.setDepartamento("  IT  ");

        ArgumentCaptor<User> cap = ArgumentCaptor.forClass(User.class);

        User saved = userService.solicitarCreacionAdmin(req);

        verify(userDao).save(cap.capture());
        assertSame(saved, cap.getValue());
        assertEquals("Ana", saved.getNombre());
        assertEquals("Admin", saved.getApellidos());
        assertEquals("root", saved.getAlias());
        assertEquals("root@mail.com", saved.getEmail());
        assertEquals(User.Role.ADMINISTRADOR, saved.getRole());
        assertEquals("IT", saved.getDepartamento());
        assertNotNull(saved.getPwd());
    }
}
