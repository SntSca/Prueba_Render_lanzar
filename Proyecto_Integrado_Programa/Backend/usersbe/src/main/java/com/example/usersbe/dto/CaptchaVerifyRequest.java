package com.example.usersbe.dto;

public class CaptchaVerifyRequest {
    private String captchaToken;
    private String answer; 

    public String getCaptchaToken() { return captchaToken; }
    public void setCaptchaToken(String captchaToken) { this.captchaToken = captchaToken; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
}
