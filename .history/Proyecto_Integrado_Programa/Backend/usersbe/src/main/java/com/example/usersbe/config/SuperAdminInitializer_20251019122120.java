package com.example.usersbe.config;

import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.model.User;
import com.example.usersbe.services.EmailService;
import com.example.usersbe.services.UserService;

import jakarta.mail.MessagingException;

@Component
public class SuperAdminInitializer implements ApplicationRunner {

    private final UserDao userDao;
    private final UserService userService;
    private final EmailService emailService;

    @Value("${app.superadmin.email}")
    private String superAdminEmail;
    @Value("${app.superadmin.initial-password:ProyectoIntegrado,1290}")
    private String initialPassword;
    @Value("${app.superadmin.alias:superadmin}")
    private String superAdminAlias;
    @Value("${app.superadmin.nombre:Super}")
    private String superAdminNombre;
    @Value("${app.superadmin.apellidos:Admin}")
    private String superAdminApellidos;
    @Value("${app.superadmin.foto:/static/fotos/image.png}")
    private String superAdminFoto;

    public SuperAdminInitializer(UserDao userDao, UserService userService, EmailService emailService) {
        this.userDao = userDao;
        this.userService = userService;
        this.emailService = emailService;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (superAdminEmail == null || superAdminEmail.isBlank()) {
            throw new IllegalStateException("Debe configurar app.superadmin.email");
        }
        final String email = superAdminEmail.trim().toLowerCase(Locale.ROOT);

        User existing = userDao.findByEmail(email);
        if (existing != null) {
            if (existing.getRole() != User.Role.ADMINISTRADOR) existing.setRole(User.Role.ADMINISTRADOR);
            if (Boolean.TRUE.equals(existing.isBlocked())) existing.setBlocked(false);
            userDao.save(existing);
            return;
        }
        final String pwd = (initialPassword == null || initialPassword.isBlank())
                ? "ProyectoIntegrado,1290"
                : initialPassword;

        userService.registrar(
                superAdminNombre,
                superAdminApellidos,
                superAdminAlias,
                email,
                "1990-01-01",
                pwd,
                false,
                superAdminFoto,
                User.Role.ADMINISTRADOR,
                null, null, null
        );
        

    }
}
