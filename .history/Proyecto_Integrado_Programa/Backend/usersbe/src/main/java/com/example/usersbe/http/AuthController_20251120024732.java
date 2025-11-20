package com.example.usersbe.http;

import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
// ❌ Ya no necesitamos @CrossOrigin aquí
import org.springframework.web.bind.annotation.*;

import com.example.usersbe.dto.CaptchaVerifyRequest;
import com.example.usersbe.dto.LoginRequest;
import com.example.usersbe.dto.LoginResponse;
import com.example.usersbe.dto.MfaVerifyRequest;
import com.example.usersbe.exceptions.BlockedUserException;
import com.example.usersbe.exceptions.InvalidCredentialsException;
import com.example.usersbe.model.User;
import com.example.usersbe.model.User.MfaMethod;
import com.example.usersbe.model.User.Role;
import com.example.usersbe.services.AuthService;
import com.example.usersbe.services.CaptchaService;
import com.example.usersbe.services.IpAttemptLimiter;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final String MSG_KEY = "message";
    private static final String ATTEMPTS_LEFT_KEY = "attemptsLeft";
    private static final String RETRY_AFTER_SEC_KEY = "retryAfterSec";

    private final AuthService authService;
    private final CaptchaService captchaService;
    private final IpAttemptLimiter ipLimiter;

    public AuthController(AuthService authService,
                          CaptchaService captchaService,
                          IpAttemptLimiter ipLimiter) {
        this.authService = authService;
        this.captchaService = captchaService;
        this.ipLimiter = ipLimiter;
    }

    @PostMapping("/login")
    public ResponseEntity<Object> login(@RequestBody LoginRequest request,
                                        HttpServletRequest httpReq) {

        final String ip = extractClientIp(httpReq);

        final long secs = ipLimiter.secondsToUnlock(ip);
        if (secs > 0) {
            final HttpHeaders h = new HttpHeaders();
            h.add(HttpHeaders.RETRY_AFTER, String.valueOf(secs));
            return new ResponseEntity<>(
                Map.of(
                    MSG_KEY, "Demasiados intentos. Prueba de nuevo en " + secs + " segundos.",
                    RETRY_AFTER_SEC_KEY, secs
                ),
                h,
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        try {
            final User u = authService.login(request.getEmail(), request.getPassword());

            if (requiresMfa(u)) {
                if (!hasMfaConfigured(u)) {
                    authService.enableEmailOtp(u);
                }
                authService.startChallenge(u);
                return ResponseEntity.ok(LoginResponse.needMfa(u.getId(), u.getMfaMethod().name()));
            }

            return ResponseEntity.ok(LoginResponse.ok(sanitize(u)));

        } catch (BlockedUserException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(MSG_KEY, "Usuario bloqueado"));
        } catch (BadCredentialsException | InvalidCredentialsException ex) {
            ipLimiter.logFailure(ip);

            final int attempts = ipLimiter.countRecent(ip);
            final int left = Math.max(0, ipLimiter.getMaxAttempts() - attempts);

            if (left <= 0) {
                final long wait = ipLimiter.secondsToUnlock(ip);
                final HttpHeaders h = new HttpHeaders();
                h.add(HttpHeaders.RETRY_AFTER, String.valueOf(wait));
                return new ResponseEntity<>(
                    Map.of(
                        MSG_KEY, "Demasiados intentos. Prueba de nuevo en " + wait + " segundos.",
                        RETRY_AFTER_SEC_KEY, wait
                    ),
                    h,
                    HttpStatus.TOO_MANY_REQUESTS
                );
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                        MSG_KEY, "Credenciales incorrectas.",
                        ATTEMPTS_LEFT_KEY, left
                    ));
        }
    }

    @PostMapping("/mfa/verify")
    public ResponseEntity<Object> verify(@RequestBody MfaVerifyRequest request) {
        final boolean ok = authService.verifyMfa(request.getMfaToken(), request.getCode());
        if (!ok) {
            return unauthorized();
        }

        final User u = authService.findById(request.getMfaToken());
        if (u == null) {
            return unauthorized();
        }

        if (requiresThirdFactor(u)) {
            final CaptchaService.CaptchaPayload cap = captchaService.generate(u.getId());
            return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(LoginResponse.needMfa3(cap.token, cap.imageBase64));
        }
        return ResponseEntity.ok(LoginResponse.ok(sanitize(u)));
    }

    @PostMapping("/mfa3/verify")
    public ResponseEntity<Object> verifyCaptcha(@RequestBody CaptchaVerifyRequest req) {
        final String answerNorm = req.getAnswer() == null ? "" : req.getAnswer().trim();
        final String userId = captchaService.verifyAndConsumeReturnUserId(req.getCaptchaToken(), answerNorm);
        if (userId == null) {
            final CaptchaService.CaptchaPayload cap = captchaService.rotate(req.getCaptchaToken());

            final HttpHeaders h = new HttpHeaders();
            h.add(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0");

            if (cap == null) {
                return new ResponseEntity<>(
                    Map.of(MSG_KEY, "Captcha expirado. Vuelve a solicitar el tercer factor."),
                    h,
                    HttpStatus.UNAUTHORIZED
                );
            }
            return new ResponseEntity<>(LoginResponse.needMfa3(cap.token, cap.imageBase64), h, HttpStatus.UNAUTHORIZED);
        }

        final User u = authService.findById(userId);
        if (u == null) {
            return unauthorized();
        }
        return ResponseEntity.ok(LoginResponse.ok(sanitize(u)));
    }

    private boolean requiresMfa(User u) {
        if (u.getRole() == Role.ADMINISTRADOR || u.getRole() == Role.GESTOR_CONTENIDO) {
            return true;
        }
        return u.isMfaEnabled() && u.getMfaMethod() != MfaMethod.NONE;
    }

    private boolean requiresThirdFactor(User u) {
        return u.getRole() == Role.ADMINISTRADOR || u.getRole() == Role.GESTOR_CONTENIDO;
    }

    private boolean hasMfaConfigured(User u) {
        if (!u.isMfaEnabled() || u.getMfaMethod() == MfaMethod.NONE) {
            return false;
        }
        return u.getMfaMethod() != MfaMethod.TOTP
                || (u.getTotpSecret() != null && !u.getTotpSecret().isBlank());
    }

    private ResponseEntity<Object> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of(
                        MSG_KEY,
                        "Problema al intentar acceder a la plataforma, por favor comuníquese con un administrador."
                ));
    }

    private Map<String, Object> sanitize(User u) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("id", u.getId());
        m.put("email", u.getEmail());
        m.put("nombre", u.getNombre());
        m.put("role", u.getRole() != null ? u.getRole().name() : null);
        m.put("alias", u.getAlias());
        m.put("foto", u.getFoto());
        m.put("descripcion", u.getDescripcion());
        m.put("especialidad", u.getEspecialidad());
        m.put("tipoContenido", u.getTipoContenido() != null ? u.getTipoContenido().name() : null);
        m.put("fechaNac", u.getFechaNac());
        return m;
    }
    private String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
