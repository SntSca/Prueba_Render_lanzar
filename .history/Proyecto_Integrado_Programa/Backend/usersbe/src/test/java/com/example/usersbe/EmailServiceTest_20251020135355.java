package com.example.usersbe;

import com.example.usersbe.services.EmailService;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.*;
import org.springframework.mail.javamail.JavaMailSender;

import java.io.File;
import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class EmailServiceTest {

    private JavaMailSender sender;
    private EmailService service;

    @BeforeEach
    void setup() {
        sender = mock(JavaMailSender.class);
        MimeMessage mm = mock(MimeMessage.class);
        when(sender.createMimeMessage()).thenReturn(mm);
        service = new EmailService(sender);
    }

    @Test
    @DisplayName("sendMail: sin logo (ruta no existe)")
    void send_no_logo() throws Exception {
        new File("Proyecto_Integrado_Programa/usersbe/src/main/resources/static/fotos/EsiMedia_Logo.png").delete();

        service.sendMail("to@mail.com","sub","<b>html</b>");

        verify(sender).createMimeMessage();
        verify(sender).send(any(MimeMessage.class));
    }

    @Test
        @DisplayName("sendMail: con logo existente → adjunta inline y envía (verificamos send)")
        void send_with_logo() throws Exception {
            File logo = new File("Proyecto_Integrado_Programa/usersbe/src/main/resources/static/fotos/EsiMedia_Logo.png");
            logo.getParentFile().mkdirs();
            if (!logo.exists()) {
                Files.writeString(logo.toPath(), "x");
            }

            try {
                service.sendMail("to@mail.com", "sub", "<b>html</b>");

                // En nuestra implementación se crea el MimeMessage una sola vez
                verify(sender, times(1)).createMimeMessage();
                verify(sender, times(1)).send(any(MimeMessage.class));
            } finally {
                // Limpieza
                try { Files.deleteIfExists(logo.toPath()); } catch (Exception ignore) {}
            }
        }
}
