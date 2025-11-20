package com.example.usersbe;

import com.example.usersbe.dto.CaptchaVerifyRequest;
import com.example.usersbe.dto.LoginRequest;
import com.example.usersbe.dto.MfaVerifyRequest;
import com.example.usersbe.model.User;
import com.example.usersbe.services.AuthService;
import com.example.usersbe.services.CaptchaService;
import com.example.usersbe.services.IpAttemptLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import jakarta.servlet.http.HttpServletRequest;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthControllerTest {

    private AuthService auth;
    private CaptchaService captcha;
    private IpAttemptLimiter limiter;
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        auth = mock(AuthService.class);
        captcha = mock(CaptchaService.class);
        limiter = mock(IpAttemptLimiter.class);

        var controller = new com.example.usersbe.http.AuthController(auth, captcha, limiter);
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    private String json(String s) { return s; }

    @Test
    @DisplayName("login: rate-limited 429 con Retry-After")
    void login_rate_limited() throws Exception {
        when(limiter.secondsToUnlock(anyString())).thenReturn(25L);
        mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("{\"email\":\"a@mail.com\",\"password\":\"x\"}")))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After","25"))
                .andExpect(jsonPath("$.message", containsString("Demasiados intentos")))
                .andExpect(jsonPath("$.retryAfterSec", is(25)));
    }

    @Test
    @DisplayName("login: usuario bloqueado 403")
    void login_blocked() throws Exception {
        when(limiter.secondsToUnlock(anyString())).thenReturn(0L);
        when(auth.login(anyString(), anyString())).thenThrow(new com.example.usersbe.exceptions.BlockedUserException());

        mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"b@mail.com\",\"password\":\"x\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", containsString("Usuario bloqueado")));
    }

    @Test
    @DisplayName("login: credenciales malas 401 con attemptsLeft")
    void login_bad_credentials() throws Exception {
        when(limiter.secondsToUnlock(anyString())).thenReturn(0L);
        doAnswer(inv -> null).when(limiter).logFailure(anyString());
        when(limiter.countRecent(anyString())).thenReturn(1);
        when(limiter.getMaxAttempts()).thenReturn(3);
        when(auth.login(anyString(), anyString()))
                .thenThrow(new com.example.usersbe.exceptions.InvalidCredentialsException());

        mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"c@mail.com\",\"password\":\"bad\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.attemptsLeft", is(2)));
    }

    @Test
    @DisplayName("login: alcanza límite → 429 con Retry-After")
    void login_hits_limit() throws Exception {
        when(limiter.secondsToUnlock(anyString())).thenReturn(0L);
        doAnswer(inv -> null).when(limiter).logFailure(anyString());
        when(limiter.countRecent(anyString())).thenReturn(3);
        when(limiter.getMaxAttempts()).thenReturn(3);
        when(limiter.secondsToUnlock(anyString())).thenReturn(60L);
        when(auth.login(anyString(), anyString()))
                .thenThrow(new com.example.usersbe.exceptions.InvalidCredentialsException());

        mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"c@mail.com\",\"password\":\"bad\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After","60"))
                .andExpect(jsonPath("$.retryAfterSec", is(60)));
    }


    @Test
    @DisplayName("mfa/verify: código inválido → 401")
    void mfa_verify_invalid() throws Exception {
        when(auth.verifyMfa(eq("u1"), eq("000000"))).thenReturn(false);

        mvc.perform(post("/auth/mfa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mfaToken\":\"u1\",\"code\":\"000000\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("Problema")));
    }

    @Test
    @DisplayName("mfa/verify: ok y ADMIN → requiere tercer factor (captcha)")
    void mfa_verify_ok_admin_needs_captcha() throws Exception {
        when(auth.verifyMfa(eq("a1"), eq("123456"))).thenReturn(true);
        User admin = new User();
        admin.setId("a1");
        admin.setRole(User.Role.ADMINISTRADOR);
        when(auth.findById("a1")).thenReturn(admin);

        CaptchaService.CaptchaPayload payload = new CaptchaService.CaptchaPayload("ctok", "imgb64");
        when(captcha.generate("a1")).thenReturn(payload);

        mvc.perform(post("/auth/mfa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mfaToken\":\"a1\",\"code\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.needMfa3", is(true)))
                .andExpect(jsonPath("$.captchaToken", is("ctok")))
                .andExpect(jsonPath("$.captchaImage", is("imgb64")));
    }

    @Test
    @DisplayName("mfa3/verify: captcha incorrecto/expirado → 401 (rota captcha)")
    void mfa3_verify_bad() throws Exception {
        // verifyAndConsumeReturnUserId devuelve null → rotamos
        when(captcha.verifyAndConsumeReturnUserId(eq("cap1"), eq("ans"))).thenReturn(null);
        when(captcha.rotate(eq("cap1"))).thenReturn(new CaptchaService.CaptchaPayload("cap2","img2"));

        mvc.perform(post("/auth/mfa3/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"captchaToken\":\"cap1\",\"answer\":\"ans\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.needMfa3", is(true)))
                .andExpect(jsonPath("$.captchaToken", is("cap2")));
    }

    @Test
    @DisplayName("mfa3/verify: captcha OK → LoginResponse.ok()")
    void mfa3_verify_ok() throws Exception {
        when(captcha.verifyAndConsumeReturnUserId(eq("cap1"), eq("ans"))).thenReturn("u1");
        User u = new User();
        u.setId("u1");
        u.setEmail("u@mail.com");
        u.setNombre("U");
        when(auth.findById("u1")).thenReturn(u);

        mvc.perform(post("/auth/mfa3/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"captchaToken\":\"cap1\",\"answer\":\"ans\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok", is(true)))
                .andExpect(jsonPath("$.user.email", is("u@mail.com")));
    }
}
