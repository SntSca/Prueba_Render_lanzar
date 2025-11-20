package com.example.usersbe.services;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.BlockedUserException;
import com.example.usersbe.exceptions.InvalidCredentialsException;
import com.example.usersbe.model.User;
import com.example.usersbe.model.User.MfaMethod;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserDao userDao;
    private final PasswordEncoder encoder;
    private final TOTPService totpService;
    private final EmailOtpService emailOtpService;

    public AuthService(UserDao userDao,
                       PasswordEncoder encoder,
                       TOTPService totpService,
                       EmailOtpService emailOtpService) {
        this.userDao = userDao;
        this.encoder = encoder;
        this.totpService = totpService;
        this.emailOtpService = emailOtpService;
    }

    public User login(String email, String rawPassword) {
        final String emailN = (email == null) ? "" : email.trim().toLowerCase();

        User u = userDao.findByEmail(emailN);
        if (u == null) {
            encoder.matches("dummy-password", "$2a$10$7qYHn3h3j9v7y2QX2sN3TeFq5QmN0T1v2y5JcJ6r1aQ3z4i6x8y9e");
            throw new InvalidCredentialsException();
        }

        if (u.isBlocked()) {
            throw new BlockedUserException();
        }

        if (!encoder.matches(rawPassword, u.getPwd())) {
            u.setFailedLoginAttempts(u.getFailedLoginAttempts() + 1);
            u.setLastFailedAt(LocalDateTime.now());
            userDao.save(u);
            throw new InvalidCredentialsException();
        }

        u.setFailedLoginAttempts(0);
        userDao.save(u);

        log.debug("Login OK para {}", emailN);
        return u;
    }

    public boolean needsMfa(User u) {
        if (!u.isMfaEnabled()) return false;
        if (u.getRole() == User.Role.ADMINISTRADOR || u.getRole() == User.Role.GESTOR_CONTENIDO) {
            return true;
        }
        return u.getMfaMethod() != MfaMethod.NONE;
    }

    public void startChallenge(User u) {
        if (u.getMfaMethod() == MfaMethod.EMAIL_OTP) {
            String code = emailOtpService.generateCode();
            u.setEmailOtpCode(code);
            u.setEmailOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
            userDao.save(u);
            emailOtpService.sendCode(u.getEmail(), code);
        }
    }

    public boolean verifyMfa(String userId, String code) {
        User u = userDao.findById(userId).orElse(null);
        if (u == null) return false;

        if (u.getMfaMethod() == MfaMethod.TOTP) {
            return totpService.verify(u.getTotpSecret(), code);
        } else if (u.getMfaMethod() == MfaMethod.EMAIL_OTP) {
            if (emailOtpService.isExpired(u.getEmailOtpExpiresAt())) return false;
            boolean ok = code != null && code.equals(u.getEmailOtpCode());
            if (ok) {
                u.setEmailOtpCode(null);
                u.setEmailOtpExpiresAt(null);
                userDao.save(u);
            }
            return ok;
        }
        return false;
    }

    public User findById(String id) {
        return userDao.findById(id).orElse(null);
    }

    public void enableTotp(User u) {
        if (u.getTotpSecret() == null) {
            u.setTotpSecret(totpService.generateSecret());
        }
        u.setMfaEnabled(true);
        u.setMfaMethod(MfaMethod.TOTP);
        userDao.save(u);
    }

    public void enableEmailOtp(User u) {
        u.setMfaEnabled(true);
        u.setMfaMethod(MfaMethod.EMAIL_OTP);
        userDao.save(u);
    }
}