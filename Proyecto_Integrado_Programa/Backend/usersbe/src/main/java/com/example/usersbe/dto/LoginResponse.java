package com.example.usersbe.dto;

import java.util.Map;

public class LoginResponse {
    private boolean ok;
    private boolean needMfa;
    private boolean needMfa3;

    private String mfaMethod;   
    private String mfaToken;    

    private String captchaToken;  
    private String captchaImage;  

    private Map<String,Object> user;

    public static LoginResponse ok(Map<String,Object> user) {
        LoginResponse r = new LoginResponse();
        r.ok = true;
        r.user = user;
        return r;
    }

    public static LoginResponse needMfa(String mfaToken, String method) {
        LoginResponse r = new LoginResponse();
        r.needMfa = true;
        r.mfaToken = mfaToken;
        r.mfaMethod = method;
        return r;
    }

    public static LoginResponse needMfa3(String captchaToken, String captchaImage) {
        LoginResponse r = new LoginResponse();
        r.needMfa3 = true;
        r.captchaToken = captchaToken;
        r.captchaImage = captchaImage;
        return r;
    }

    public boolean isOk() { return ok; }
    public boolean isNeedMfa() { return needMfa; }
    public boolean isNeedMfa3() { return needMfa3; }
    public String getMfaMethod() { return mfaMethod; }
    public String getMfaToken() { return mfaToken; }
    public String getCaptchaToken() { return captchaToken; }
    public String getCaptchaImage() { return captchaImage; }
    public Map<String, Object> getUser() { return user; }

    public void setOk(boolean ok) { this.ok = ok; }
    public void setNeedMfa(boolean needMfa) { this.needMfa = needMfa; }
    public void setNeedMfa3(boolean needMfa3) { this.needMfa3 = needMfa3; }
    public void setMfaMethod(String mfaMethod) { this.mfaMethod = mfaMethod; }
    public void setMfaToken(String mfaToken) { this.mfaToken = mfaToken; }
    public void setCaptchaToken(String captchaToken) { this.captchaToken = captchaToken; }
    public void setCaptchaImage(String captchaImage) { this.captchaImage = captchaImage; }
    public void setUser(Map<String, Object> user) { this.user = user; }
}