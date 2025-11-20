package com.example.usersbe.services;

import java.io.File;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendMail(String to, String subject, String htmlContent) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        // Configurar remitente
        helper.setFrom("tu-email@gmail.com"); // Cambia por tu correo Gmail
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlContent, true); // true = HTML

        // Agregar imagen inline
        File logoFile = new File("Proyecto_Integrado_Programa/usersbe/src/main/resources/static/fotos/EsiMedia_Logo.png");
        if (logoFile.exists() && logoFile.isFile()) {
            FileSystemResource logo = new FileSystemResource(logoFile);
            helper.addInline("logoEsiMedia", logo);
        } else {
            System.out.println("⚠️ Logo no encontrado: " + logoFile.getAbsolutePath() + ". Se enviará el correo sin logo.");
        }

        // Enviar correo
        mailSender.send(message);
        System.out.println("✅ Correo enviado a " + to);
    }

}

