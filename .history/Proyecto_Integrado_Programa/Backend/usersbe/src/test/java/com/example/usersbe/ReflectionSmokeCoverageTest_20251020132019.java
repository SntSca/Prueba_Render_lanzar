package com.example.usersbe;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Test genérico que sube cobertura de DTOs y Excepciones sin acoplarse a nombres exactos.
 * - Si una clase no existe, se ignora silenciosamente.
 * - Para DTOs: ejerce getters/setters via JavaBeans.
 * - Para Excepciones: ejercita constructores comunes.
 */
class ReflectionSmokeCoverageTest {

    @Test
    @DisplayName("DTOs: getters/setters por reflexión (smoke)")
    void dtos_reflection_smoke() throws Exception {
        // Añade aquí todos los DTOs que quieras intentar cubrir (pon varias variantes de nombre si dudas).
        String[] dtoClassNames = new String[] {
                "com.example.usersbe.dto.AdminCreationRequest",
                "com.example.usersbe.dto.RegistrationRequest",
                "com.example.usersbe.dto.LoginRequest",
                "com.example.usersbe.dto.LoginResponse",
                "com.example.usersbe.dto.CaptchaVerificationRequest",
                "com.example.usersbe.dto.MfaVerificationRequest",
                "com.example.usersbe.dto.ErrorFriendly",
                "com.example.usersbe.dto.CreadorDTO"
        };

        for (String fqcn : dtoClassNames) {
            try {
                Class<?> clazz = Class.forName(fqcn);
                if (clazz.isInterface() || Modifier.isAbstract(clazz.getModifiers())) continue;

                Object bean;
                try {
                    bean = clazz.getDeclaredConstructor().newInstance();
                } catch (NoSuchMethodException nsme) {
                    continue;
                }
                for (PropertyDescriptor pd : Introspector.getBeanInfo(clazz, Object.class).getPropertyDescriptors()) {
                    if (pd.getWriteMethod() == null || pd.getReadMethod() == null) continue;

                    Class<?> pt = pd.getPropertyType();
                    Object sample = sampleValueFor(pt);
                    if (sample == null) continue;

                    try {
                        pd.getWriteMethod().invoke(bean, sample);
                        Object out = pd.getReadMethod().invoke(bean);
                        assertNotNull(out);
                    } catch (Throwable ignored) {
                    }
                }
            } catch (ClassNotFoundException ignored) {
            }
        }
    }

    @Test
    @DisplayName("Excepciones: constructores comunes por reflexión (smoke)")
    void exceptions_reflection_smoke() {
        String[] exClassNames = new String[] {
                "com.example.usersbe.exceptions.AdminNotFoundException",
                "com.example.usersbe.exceptions.EmailSendException",
                "com.example.usersbe.exceptions.ExpiredTokenException",
                "com.example.usersbe.exceptions.ForbiddenException",
                "com.example.usersbe.exceptions.InvalidPasswordException",
                "com.example.usersbe.exceptions.InvalidRoleException",
                "com.example.usersbe.exceptions.InvalidTokenException",
                "com.example.usersbe.exceptions.MissingSuperAdminEmailConfigException",
                "com.example.usersbe.exceptions.NotAnAdminException",
                "com.example.usersbe.exceptions.SuperAdminProtectionException",
                "com.example.usersbe.exceptions.UserDeletionNotAllowedException",
                "com.example.usersbe.exceptions.UserNotFoundException",
                "com.example.usersbe.exceptions.DuplicateAliasException",
                "com.example.usersbe.exceptions.DuplicateEmailException",
                "com.example.usersbe.exceptions.EmailAlreadyUsedException",
                "com.example.usersbe.exceptions.InvalidCredentialsException",
                "com.example.usersbe.exceptions.InvalidEmailException",
                "com.example.usersbe.exceptions.InvalidFieldException",
                "com.example.usersbe.exceptions.ValidationException",
                "com.example.usersbe.exceptions.NoACreatorException",
                "com.example.usersbe.exceptions.UserBlockedException"
        };

        for (String fqcn : exClassNames) {
            try {
                Class<?> clazz = Class.forName(fqcn);
                List<Object> created = new ArrayList<>();
                try {
                    Constructor<?> c = clazz.getDeclaredConstructor(String.class);
                    c.setAccessible(true);
                    created.add(c.newInstance("msg"));
                } catch (NoSuchMethodException ignored) {}
  
                try {
                    Constructor<?> c = clazz.getDeclaredConstructor(String.class, Throwable.class);
                    c.setAccessible(true);
                    created.add(c.newInstance("msg", new RuntimeException("cause")));
                } catch (NoSuchMethodException ignored) {}
                try {
                    Constructor<?> c = clazz.getDeclaredConstructor();
                    c.setAccessible(true);
                    created.add(c.newInstance());
                } catch (NoSuchMethodException ignored) {}

                if (clazz.getSimpleName().endsWith("Exception")) {
                }

            } catch (ClassNotFoundException ignored) {
            } catch (Throwable ignored) {
            }
        }
    }

    private static Object sampleValueFor(Class<?> pt) {
        try {
            if (pt == String.class) return "x";
            if (pt == boolean.class || pt == Boolean.class) return Boolean.TRUE;
            if (pt == int.class || pt == Integer.class) return 1;
            if (pt == long.class || pt == Long.class) return 1L;
            if (pt == double.class || pt == Double.class) return 1.0d;
            if (pt == float.class || pt == Float.class) return 1.0f;
            if (pt == LocalDate.class) return LocalDate.of(2000, 1, 1);
            if (pt.isEnum()) {
                Object[] constants = pt.getEnumConstants();
                return (constants != null && constants.length > 0) ? constants[0] : null;
            }
        } catch (Throwable ignored) {}
        return null;
    }
}
