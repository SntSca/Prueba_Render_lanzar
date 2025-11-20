package com.example.usersbe.config;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.MissingSuperAdminEmailConfigException;
import com.example.usersbe.exceptions.SuperAdminProtectionException;
import com.example.usersbe.model.User;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.BeforeDeleteEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveEvent;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
@Primary
public class SuperAdminMongoGuard extends AbstractMongoEventListener<User> {

    private final UserDao userDao;

    @Value("${app.superadmin.email:}")
    private String superAdminEmail;

    public SuperAdminMongoGuard(UserDao userDao) {
        this.userDao = userDao;
    }

    private boolean isPrevSuperAdmin(User prev) {
        if (prev == null) return false;
        if (superAdminEmail == null || superAdminEmail.isBlank()) {
            throw new MissingSuperAdminEmailConfigException();
        }
        return prev.getRole() == User.Role.ADMINISTRADOR
                && superAdminEmail.trim().equalsIgnoreCase(prev.getEmail());
    }

    @Override
    public void onBeforeDelete(BeforeDeleteEvent<User> event) {
        final Document criteria = event.getDocument();
        if (criteria != null && criteria.containsKey("_id")) {
            final String id = String.valueOf(criteria.get("_id"));
            final User toDelete = userDao.findById(id).orElse(null);
            if (toDelete != null && isPrevSuperAdmin(toDelete)) {
                throw new SuperAdminProtectionException("eliminar al superAdmin");
            }
        }
        super.onBeforeDelete(event);
    }

    @Override
    public void onBeforeSave(BeforeSaveEvent<User> event) {
        final User u = Objects.requireNonNull(event.getSource(), "User source cannot be null");
        if (u.getId() == null) {
            super.onBeforeSave(event);
            return;
        }
        final User prev = userDao.findById(u.getId()).orElse(null);
        if (prev == null) {
            super.onBeforeSave(event);
            return;
        }
        if (isPrevSuperAdmin(prev)) {
            final String prevEmail = prev.getEmail() == null ? "" : prev.getEmail();
            final String newEmail  = u.getEmail() == null ? "" : u.getEmail();
            if (!prevEmail.equalsIgnoreCase(newEmail)) {
                throw new SuperAdminProtectionException("modificar el email del superAdmin");
            }
            if (prev.getRole() != u.getRole()) {
                throw new SuperAdminProtectionException("modificar el rol del superAdmin");
            }
            if (Boolean.TRUE.equals(u.isBlocked())) {
                throw new SuperAdminProtectionException("bloquear al superAdmin");
            }
        }

        super.onBeforeSave(event);
    }
}
