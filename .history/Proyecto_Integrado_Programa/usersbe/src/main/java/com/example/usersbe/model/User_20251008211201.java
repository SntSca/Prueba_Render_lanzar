package com.example.usersbe.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Transient;

@Document(collection = "users")
public class User {
    public enum Role {
        USUARIO, GESTOR_CONTENIDO, ADMINISTRADOR
    }

    public enum MfaMethod {
        NONE, TOTP, EMAIL_OTP
    }

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String nombre;
    private String apellidos;
    private String alias;
    private LocalDate fechaNac;
    private String pwd;
    private boolean vip;
    private String foto;
    private Role role = Role.USUARIO;

    @Transient
    private String confirmarPwd;

    private boolean mfaEnabled = false;
    private MfaMethod mfaMethod = MfaMethod.NONE;
    private String totpSecret; 
    private String emailOtpCode; 
    private LocalDateTime emailOtpExpiresAt;

    private int failedLoginAttempts = 0;
    private LocalDateTime lastFailedAt;
    private boolean blocked = false;

    public User() { this.id = UUID.randomUUID().toString(); }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellidos() { return apellidos; }
    public void setApellidos(String apellidos) { this.apellidos = apellidos; }

    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }

    public LocalDate getFechaNac() { return fechaNac; }
    public void setFechaNac(LocalDate fechaNac) { this.fechaNac = fechaNac; }

    public String getPwd() { return pwd; }
    public void setPwd(String pwd) { this.pwd = pwd; }

    public boolean isVip() { return vip; }
    public void setVip(boolean vip) { this.vip = vip; }

    public String getFoto() { return foto; }
    public void setFoto(String foto) { this.foto = foto; }

    public String getConfirmarPwd() { return confirmarPwd; }
    public void setConfirmarPwd(String confirmarPwd) { this.confirmarPwd = confirmarPwd; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public boolean isMfaEnabled() { return mfaEnabled; }
    public void setMfaEnabled(boolean mfaEnabled) { this.mfaEnabled = mfaEnabled; }

    public MfaMethod getMfaMethod() { return mfaMethod; }
    public void setMfaMethod(MfaMethod mfaMethod) { this.mfaMethod = mfaMethod; }

    public String getTotpSecret() { return totpSecret; }
    public void setTotpSecret(String totpSecret) { this.totpSecret = totpSecret; }

    public String getEmailOtpCode() { return emailOtpCode; }
    public void setEmailOtpCode(String emailOtpCode) { this.emailOtpCode = emailOtpCode; }

    public LocalDateTime getEmailOtpExpiresAt() { return emailOtpExpiresAt; }
    public void setEmailOtpExpiresAt(LocalDateTime emailOtpExpiresAt) { this.emailOtpExpiresAt = emailOtpExpiresAt; }

    public int getFailedLoginAttempts() { return failedLoginAttempts; }
    public void setFailedLoginAttempts(int failedLoginAttempts) { this.failedLoginAttempts = failedLoginAttempts; }

    public LocalDateTime getLastFailedAt() { return lastFailedAt; }
    public void setLastFailedAt(LocalDateTime lastFailedAt) { this.lastFailedAt = lastFailedAt; }

    public boolean isBlocked() { return blocked; }
    public void setBlocked(boolean blocked) { this.blocked = blocked; }

        public String getResetPasswordToken() { return resetPasswordToken; }
    public void setResetPasswordToken(String resetPasswordToken) { this.resetPasswordToken = resetPasswordToken; }

    public LocalDateTime getResetPasswordExpires() { return resetPasswordExpires; }
    public void setResetPasswordExpires(LocalDateTime resetPasswordExpires) { this.resetPasswordExpires = resetPasswordExpires; }
}
