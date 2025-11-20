package com.example.usersbe.dto;

public class MfaVerifyRequest {
    private String mfaToken; 
    private String code;

    public String getMfaToken() { return mfaToken; }
    public void setMfaToken(String mfaToken) { this.mfaToken = mfaToken; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
}

