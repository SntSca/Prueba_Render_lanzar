package com.example.usersbe;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.BlockedUserException;
import com.example.usersbe.exceptions.InvalidCredentialsException;
import com.example.usersbe.model.User;
import com.example.usersbe.services.AuthService;
import com.example.usersbe.services.EmailOtpService;
import com.example.usersbe.services.TOTPService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthServiceTest {

    private UserDao userDao;
    private PasswordEncoder encoder;
    private TOTPService totp;
    private EmailOtpService emailOtp;
    private AuthService auth;

    private User userU;

    @BeforeEach
    void setup() {
        userDao = mock(UserDao.class);
        encoder = mock(PasswordEncoder.class);
        totp = mock(TOTPService.class);
        emailOtp = mock(EmailOtpService.class);

        // El constructor llama encoder.encode(random)
        when(encoder.encode(anyString())).thenReturn("DUMMY_HASH");

        when(encoder.matches(anyString(), anyString())).thenAnswer(inv -> {
            String raw = inv.getArgument(0);
            String hash = inv.getArgument(1);
            return "ok".equals(raw) && "HASH_ok".equals(hash);
        });

        auth = new AuthService(userDao, encoder, totp, emailOtp);

        userU = new User();
        userU.setId("u1");
        userU.setEmail("u@mail.com");
        userU.setNombre("U");
        userU.setRole(User.Role.USUARIO);
        userU.setPwd("HASH_ok");
        userU.setMfaEnabled(false);
        userU.setMfaMethod(User.MfaMethod.NONE);
        userU.setFechaNac(LocalDate.of(2000,1,1));
    }

    @Test
    @DisplayName("login OK reinicia intentos")
    void login_ok() {
        when(userDao.findByEmail("u@mail.com")).thenReturn(userU);
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        userU.setFailedLoginAttempts(3);
        User res = auth.login("  U@mail.com ", "ok");

        assertEquals("u1", res.getId());
        assertEquals(0, res.getFailedLoginAttempts());
        verify(userDao, atLeastOnce()).save(userU);
    }

    @Test
    @DisplayName("login: usuario no existe → InvalidCredentials y hace matches dummy para mitigar timing")
    void login_user_not_found() {
        when(userDao.findByEmail("ghost@mail.com")).thenReturn(null);
        assertThrows(InvalidCredentialsException.class, () -> auth.login("  ghost@mail.com ", "x"));
        // se invoca encoder.matches con el hash dummy
        verify(encoder, atLeastOnce()).matches(anyString(), eq("DUMMY_HASH"));
    }

    @Test
    @DisplayName("login: bloqueado → BlockedUserException")
    void login_blocked() {
        userU.setBlocked(true);
        when(userDao.findByEmail("u@mail.com")).thenReturn(userU);
        assertThrows(BlockedUserException.class, () -> auth.login("u@mail.com","ok"));
        verify(userDao, never()).save(any());
    }

    @Test
    @DisplayName("login: password incorrecta aumenta contador y guarda")
    void login_bad_password_increments() {
        when(userDao.findByEmail("u@mail.com")).thenReturn(userU);
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        assertThrows(InvalidCredentialsException.class, () -> auth.login("u@mail.com", "bad"));
        assertEquals(1, userU.getFailedLoginAttempts());
        assertNotNull(userU.getLastFailedAt());
        verify(userDao).save(userU);
    }

    @Test
    @DisplayName("needsMfa: true para ADMIN/CREADOR; para usuario depende de flags")
    void needsMfa_cases() {
        userU.setMfaEnabled(false);
        assertFalse(auth.needsMfa(userU));

        userU.setMfaEnabled(true);
        userU.setMfaMethod(User.MfaMethod.NONE);
        assertFalse(auth.needsMfa(userU));

        userU.setMfaMethod(User.MfaMethod.EMAIL_OTP);
        assertTrue(auth.needsMfa(userU));

        User admin = new User();
        admin.setRole(User.Role.ADMINISTRADOR);
        assertTrue(auth.needsMfa(admin));

        User creador = new User();
        creador.setRole(User.Role.GESTOR_CONTENIDO);
        assertTrue(auth.needsMfa(creador));
    }

    @Test
    @DisplayName("startChallenge EMAIL_OTP: genera, guarda y envía")
    void startChallenge_emailOtp() {
        userU.setMfaEnabled(true);
        userU.setMfaMethod(User.MfaMethod.EMAIL_OTP);

        when(emailOtp.generateCode()).thenReturn("123456");
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        auth.startChallenge(userU);

        assertEquals("123456", userU.getEmailOtpCode());
        assertNotNull(userU.getEmailOtpExpiresAt());
        verify(emailOtp).sendCode(eq("u@mail.com"), eq("123456"));
        verify(userDao).save(userU);
    }

    @Test
    @DisplayName("verifyMfa: TOTP OK")
    void verifyMfa_totp_ok() {
        userU.setMfaMethod(User.MfaMethod.TOTP);
        userU.setTotpSecret("S");
        when(userDao.findById("u1")).thenReturn(Optional.of(userU));
        when(totp.verify("S", "000111")).thenReturn(true);

        assertTrue(auth.verifyMfa("u1","000111"));
    }

    @Test
    @DisplayName("verifyMfa: EMAIL_OTP ok y limpia código; expirado=false")
    void verifyMfa_email_otp() {
        userU.setMfaMethod(User.MfaMethod.EMAIL_OTP);
        userU.setEmailOtpCode("222333");
        userU.setEmailOtpExpiresAt(LocalDateTime.now().plusMinutes(5));
        when(userDao.findById("u1")).thenReturn(Optional.of(userU));
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(emailOtp.isExpired(any())).thenReturn(false);

        assertTrue(auth.verifyMfa("u1","222333"));
        assertNull(userU.getEmailOtpCode());
        assertNull(userU.getEmailOtpExpiresAt());
        verify(userDao).save(userU);
    }

    @Test
    @DisplayName("verifyMfa: EMAIL_OTP expirado devuelve false")
    void verifyMfa_email_otp_expired() {
        userU.setMfaMethod(User.MfaMethod.EMAIL_OTP);
        when(userDao.findById("u1")).thenReturn(Optional.of(userU));
        when(emailOtp.isExpired(any())).thenReturn(true);
        assertFalse(auth.verifyMfa("u1","xxx"));
    }

    @Test
    @DisplayName("finders y enable MFA")
    void finders_and_enable() {
        when(userDao.findById("u1")).thenReturn(Optional.of(userU));
        when(userDao.findByEmail("u@mail.com")).thenReturn(userU);
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(totp.generateSecret()).thenReturn("TSECRET");

        assertNotNull(auth.findById("u1"));
        assertEquals(userU, auth.findByIdOrEmail("u1", null));
        assertEquals(userU, auth.findByIdOrEmail(null, "  U@mail.com "));

        auth.enableTotp(userU);
        assertEquals("TSECRET", userU.getTotpSecret());
        assertTrue(userU.isMfaEnabled());
        assertEquals(User.MfaMethod.TOTP, userU.getMfaMethod());

        auth.enableEmailOtp(userU);
        assertEquals(User.MfaMethod.EMAIL_OTP, userU.getMfaMethod());

        assertTrue(auth.hasMfaConfigured(userU));

        // si no hay nada configurado
        User none = new User();
        none.setMfaEnabled(false);
        none.setMfaMethod(User.MfaMethod.NONE);
        assertFalse(auth.hasMfaConfigured(none));
    }
}
