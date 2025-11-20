package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class ContenidoControllerCoverageTest {

    @Mock
    private ContenidoService contenidoService;

    @InjectMocks
    private ContenidoController controller;

    private MockMvc mvc;
    private final ObjectMapper om = new ObjectMapper();

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void resolveEmail_withHeader() {
        // For header email
        String email = controller.resolveEmail("header@mail.com");
        assertEquals("header@mail.com", email);
    }

    @Test
    void commonHeaders_returnsHttpHeaders() {
        HttpHeaders headers = controller.commonHeaders(MediaType.APPLICATION_JSON);
        assertEquals(MediaType.APPLICATION_JSON, headers.getContentType());
        assertEquals("bytes", headers.getFirst(HttpHeaders.ACCEPT_RANGES));
    }

    @Test
    void resolveMediaType_withMimeAndPath() throws Exception {
        MediaType mt = controller.resolveMediaType("text/plain", null);
        assertEquals(MediaType.TEXT_PLAIN, mt);

        Path tempFile = Files.createTempFile("test", ".txt");
        MediaType fromFile = controller.resolveMediaType(null, tempFile);
        assertEquals(MediaType.TEXT_PLAIN, fromFile);
        Files.delete(tempFile);

        MediaType fallback = controller.resolveMediaType(null, null);
        assertEquals(MediaType.APPLICATION_OCTET_STREAM, fallback);
    }

    @Test
    void resolveAge_withDirectAndBirthdate() {
        // Direct age
        assertEquals(25, controller.resolveAge(null, 25));

        // Invalid birthdate -> returns null
        assertNull(controller.resolveAge("invalid-date", null));
    }

    @Test
    void stream_local_returnsPartialContent() throws Exception {
        Path tmp = Files.createTempFile("video", ".bin");
        Files.write(tmp, new byte[1024]); // 1KB file

        StreamingTarget target = mock(StreamingTarget.class);
        when(target.isExternalRedirect()).thenReturn(false);
        when(target.length()).thenReturn(1024L);
        when(target.path()).thenReturn(tmp);
        when(target.mimeType()).thenReturn("application/octet-stream");

        when(contenidoService.resolveStreamingTarget(anyString(), any(), any())).thenReturn(target);

        HttpHeaders headers = new HttpHeaders();
        headers.setRange(List.of(HttpHeaders.parseRange("bytes=0-511").get(0)));

        ResponseEntity<Object> resp = controller.stream("id", headers, null, null, null, null, null, null);
        assertEquals(206, resp.getStatusCodeValue());
        assertTrue(resp.getBody() instanceof InputStreamResource);

        Files.delete(tmp);
    }

    @Test
    void head_externalRedirect_ok() throws Exception {
        StreamingTarget target = mock(StreamingTarget.class);
        when(target.isExternalRedirect()).thenReturn(true);
        when(target.mimeType()).thenReturn("video/mp4");
        when(contenidoService.resolveStreamingTarget(anyString(), any(), any())).thenReturn(target);

        ResponseEntity<Void> resp = controller.head("id", null, null, null);
        assertEquals(200, resp.getStatusCodeValue());
    }

    @Test
    void addFavorito_ok() throws Exception {
        doNothing().when(contenidoService).addFavorito(anyString(), anyString(), anyString());
        ResponseEntity<Void> resp = controller.addFavorito("c1", "user@mail.com", "USER");
        assertEquals(201, resp.getStatusCodeValue());
        assertTrue(resp.getHeaders().getLocation().toString().endsWith("/c1/favorito"));
    }

    @Test
    void removeFavorito_ok() {
        doNothing().when(contenidoService).removeFavorito(anyString(), anyString());
        ResponseEntity<Void> resp = controller.removeFavorito("c1", "user@mail.com");
        assertEquals(204, resp.getStatusCodeValue());
    }

    @Test
    void listFavoritos_ok() {
        when(contenidoService.listFavoritosIds("user@mail.com")).thenReturn(List.of("c1","c2"));
        ResponseEntity<List<String>> resp = controller.listFavoritos("user@mail.com");
        assertEquals(List.of("c1","c2"), resp.getBody());
    }

}
