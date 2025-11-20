package com.example.usersbe;

import com.example.usersbe.dto.LoginResponse;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class LoginResponseTest {

    @Test
    void factories_and_getters() {
        var ok = LoginResponse.ok(Map.of("id","u1"));
        assertTrue(ok.isOk());
        assertEquals("u1", ok.getUser().get("id"));

        var needMfa = LoginResponse.needMfa("tok","EMAIL_OTP");
        assertTrue(needMfa.isNeedMfa());
        assertEquals("tok", needMfa.getMfaToken());
        assertEquals("EMAIL_OTP", needMfa.getMfaMethod());

        var needMfa3 = LoginResponse.needMfa3("ct","img");
        assertTrue(needMfa3.isNeedMfa3());
        assertEquals("ct", needMfa3.getCaptchaToken());
        assertEquals("img", needMfa3.getCaptchaImage());

        // setters (para completar cobertura)
        ok.setOk(false);
        ok.setUser(Map.of("x","y"));
        ok.setNeedMfa(true);
        ok.setNeedMfa3(true);
        ok.setMfaMethod("TOTP");
        ok.setMfaToken("t2");
        ok.setCaptchaToken("c2");
        ok.setCaptchaImage("i2");

        assertFalse(ok.isOk());
        assertEquals("y", ok.getUser().get("x"));
        assertTrue(ok.isNeedMfa());
        assertTrue(ok.isNeedMfa3());
        assertEquals("TOTP", ok.getMfaMethod());
        assertEquals("t2", ok.getMfaToken());
        assertEquals("c2", ok.getCaptchaToken());
        assertEquals("i2", ok.getCaptchaImage());
    }
}
