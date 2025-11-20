package com.example.usersbe.services;

import java.io.File;

import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {
    private final JavaMailSender mailSender;
    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }


    public void sendMail(String to, String subject, String htmlContent) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom("esimedia2025@gmail.com");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlContent, true);

        File logoFile = new File("Proyecto_Integrado_Programa/usersbe/src/main/resources/static/fotos/EsiMedia_Logo.png");
        if (logoFile.exists() && logoFile.isFile()) {
            FileSystemResource logo = new FileSystemResource(logoFile);
            helper.addInline("logoEsiMedia", logo);
        }
        mailSender.send(message);
    }


}

