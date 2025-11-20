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

    public void sendMailWithInlineImage(String to, String subject, String htmlContent, String imagePath) throws MessagingException {

        MimeMessage message = mailSender.createMimeMessage();

        // UTF-8 evita problemas de codificación
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom("tu-email@gmail.com"); // tu correo Gmail
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlContent, true); // true = HTML

        // Adjuntar imagen inline
        File imageFile = new File(imagePath);
        if (!imageFile.exists()) {
            throw new RuntimeException("La imagen no existe: " + imageFile.getAbsolutePath());
        }
        FileSystemResource logo = new FileSystemResource(imageFile);
        helper.addInline("logo", logo); // El "cid" en tu HTML debe coincidir con "logo"

    mailSender.send(message);
    System.out.println("Correo enviado correctamente a " + to);

}
}

