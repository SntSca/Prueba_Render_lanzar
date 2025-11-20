package com.example.usersbe.services;

import java.io.File;
import java.io.UnsupportedEncodingException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendMail(String to, String subject, String htmlContent)
            throws MessagingException, UnsupportedEncodingException {

        // Validar email mínimo (opcional)
        if (to == null || !to.contains("@")) {
            throw new IllegalArgumentException("Email destinatario no válido");
        }

        MimeMessage message = mailSender.createMimeMessage();

        // UTF-8 para evitar errores de codificación
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        // Remitente con nombre amigable codificado en UTF-8
        helper.setFrom(new InternetAddress("no-reply@tudominio.com", "EsiMedia", "UTF-8"));

        // Destinatario
        helper.setTo(to);

        // Asunto
        helper.setSubject(subject);
        helper.setText(htmlContent, true);
        File logoFile = new File("Proyecto_Integrado_Programa/usersbe/src/main/resources/static/fotos/EsiMedia_Logo.png");
        if (logoFile.exists()) {
            FileSystemResource logo = new FileSystemResource(logoFile);
            helper.addInline("logoEsiMedia", logo);
        }
        mailSender.send(message);
    }
}

