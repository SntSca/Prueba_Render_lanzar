package com.example.usersbe.services;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
public class EmailOtpService {
    private final SecureRandom secureRandom = new SecureRandom();
    private final JavaMailSender mailSender;
    @Value("${app.mail.from}")
    private String from;

    public EmailOtpService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendCode(String to, String code) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper =
                    new MimeMessageHelper(msg, false, StandardCharsets.UTF_8.name());

            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("ESIMedia – Código de verificación");
            helper.setText(
                "Tu código de acceso es: " + code + "\n\n" +
                "Caduca en 10 minutos. Si no has solicitado este código, ignora este mensaje.",
                false
            );

            mailSender.send(msg);

        } catch (MessagingException | MailException e) {
            throw new IllegalStateException("No se pudo enviar el correo de OTP", e);
        }
    }

    public String generateCode() {
        int n = secureRandom.nextInt(1_000_000);
        return String.format("%06d", n);
    }
    
    public boolean isExpired(LocalDateTime expiresAt) {
        return expiresAt == null || LocalDateTime.now().isAfter(expiresAt);
    }
    public void sendAdminLoginAlert(String to, String adminAlias, String adminEmail, String ip, LocalDateTime when) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper =
                    new MimeMessageHelper(msg, false, StandardCharsets.UTF_8.name());

            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("ESIMedia – Alerta de inicio de sesión (ADMIN)");

            String text = """
                Se ha detectado un inicio de sesión de un usuario con rol ADMINISTRADOR.

                Alias: %s
                Email: %s
                IP: %s
                Fecha/Hora: %s

                Este correo es solo informativo.
                """.formatted(
                    adminAlias != null ? adminAlias : "(sin alias)",
                    adminEmail != null ? adminEmail : "(sin email)",
                    ip != null ? ip : "(desconocida)",
                    when != null ? when.toString() : LocalDateTime.now().toString()
                );

            helper.setText(text, false);
            mailSender.send(msg);

        } catch (MessagingException | MailException e) {
            throw new IllegalStateException("No se pudo enviar la alerta de login de admin", e);
        }
    }
}