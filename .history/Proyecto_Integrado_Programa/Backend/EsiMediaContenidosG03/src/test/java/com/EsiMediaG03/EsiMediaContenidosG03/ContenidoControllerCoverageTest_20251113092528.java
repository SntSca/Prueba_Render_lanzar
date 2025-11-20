package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;


import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContenidoControllerTest {

    @Mock
    private ContenidoService contenidoService;

    @InjectMocks
    private ContenidoController controller;

    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void testAnadirContenido() throws Throwable {
        Contenido contenido = new Contenido();
        contenido.setTitulo("Video Test");
        contenido.setTipo(Contenido.Tipo.VIDEO);

        when(contenidoService.anadirContenido(any())).thenReturn(contenido);

        ResponseEntity<Contenido> resp = controller.anadirContenido(contenido);
        assertEquals(201, resp.getStatusCodeValue());
        assertEquals("Video Test", resp.getBody().getTitulo());
    }

    @Test
    void testStreamExternalRedirect() throws Exception {
        StreamingTarget target = mock(StreamingTarget.class);
        when(target.isExternalRedirect()).thenReturn(true);
        when(target.externalUrl()).thenReturn("https://cdn.example.com/video.mp4");
        when(target.mimeType()).thenReturn("video/mp4");
        when(contenidoService.resolveStreamingTarget(anyString(), any(), any())).thenReturn(target);

        ResponseEntity<Object> resp = controller.stream("id", new HttpHeaders(), null, null, null, null, null, null);
        assertEquals(302, resp.getStatusCodeValue());
        assertEquals("https://cdn.example.com/video.mp4", resp.getHeaders().getFirst(HttpHeaders.LOCATION));
    }

    @Test
    void testResolveAgeDirectAndBirthdate() {
        assertEquals(30, controller.resolveAge(null, 30));
        assertNull(controller.resolveAge("invalid-date", null));
        // Con fecha válida
        assertEquals(23, controller.resolveAge(LocalDate.now().minusYears(23).toString(), null));
    }

    @Test
    void testResolveMediaType() throws Exception {
        // Con MIME
        assertEquals(MediaType.TEXT_PLAIN, controller.resolveMediaType("text/plain", null));
        // Con archivo
        Path tmp = Files.createTempFile("test", ".txt");
        MediaType mt = controller.resolveMediaType(null, tmp);
        assertEquals(MediaType.TEXT_PLAIN, mt);
        Files.delete(tmp);
        // Sin nada
        assertEquals(MediaType.APPLICATION_OCTET_STREAM, controller.resolveMediaType(null, null));
    }

    @Test
    void testResolveEmail() {
        // Header simple
        String email = controller.resolveEmail("user@mail.com");
        assertEquals("user@mail.com", email);
    }
}
