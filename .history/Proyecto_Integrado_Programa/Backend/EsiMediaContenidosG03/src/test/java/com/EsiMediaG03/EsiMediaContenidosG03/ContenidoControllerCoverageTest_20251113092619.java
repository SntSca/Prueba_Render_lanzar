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
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContenidoControllerTest {

    @Mock
    private ContenidoService contenidoService;

    @InjectMocks
    private ContenidoController controller;

    private Contenido contenido;

    @BeforeEach
    void setup() {
        contenido = new Contenido();
        contenido.setTitulo("Test Video");
        contenido.setTipo(Contenido.Tipo.VIDEO);
    }

    @Test
    void testAnadirContenido() throws Throwable {
        when(contenidoService.anadirContenido(any())).thenReturn(contenido);
        ResponseEntity<Contenido> resp = controller.anadirContenido(contenido);
        assertEquals(201, resp.getStatusCodeValue());
        assertEquals("Test Video", resp.getBody().getTitulo());
    }

    @Test
    void testListarContenidos() {
        when(contenidoService.listarContenidos()).thenReturn(List.of(contenido));
        ResponseEntity<List<Contenido>> resp = controller.listarContenidos();
        assertEquals(1, resp.getBody().size());
    }

    @Test
    void testStreamLocalPartialContent() throws Exception {
        Path tmp = Files.createTempFile("video", ".bin");
        Files.write(tmp, new byte[1024]);
        StreamingTarget target = mock(StreamingTarget.class);
        when(target.isExternalRedirect()).thenReturn(false);
        when(target.path()).thenReturn(tmp);
        when(target.length()).thenReturn(1024L);
        when(target.mimeType()).thenReturn("application/octet-stream");
        when(contenidoService.resolveStreamingTarget(any(), any(), any())).thenReturn(target);

        HttpHeaders headers = new HttpHeaders();
        headers.setRange(List.of(HttpHeaders.parseRange("bytes=0-511").get(0)));

        ResponseEntity<Object> resp = controller.stream("id", headers, null, null, null, null, null, null);
        assertEquals(206, resp.getStatusCodeValue());
        assertTrue(resp.getBody() instanceof InputStreamResource);

        Files.delete(tmp);
    }

    @Test
    void testStreamExternalRedirect() throws Exception {
        StreamingTarget target = mock(StreamingTarget.class);
        when(target.isExternalRedirect()).thenReturn(true);
        when(target.externalUrl()).thenReturn("https://cdn.example.com/video.mp4");
        when(contenidoService.resolveStreamingTarget(any(), any(), any())).thenReturn(target);

        ResponseEntity<Object> resp = controller.stream("id", new HttpHeaders(), null, null, null, null, null, null);
        assertEquals(302, resp.getStatusCodeValue());
        assertEquals("https://cdn.example.com/video.mp4", resp.getHeaders().getLocation().toString());
    }

    @Test
    void testHeadLocal() throws Exception {
        StreamingTarget target = mock(StreamingTarget.class);
        when(target.isExternalRedirect()).thenReturn(false);
        when(target.path()).thenReturn(Files.createTempFile("video", ".bin"));
        when(target.length()).thenReturn(100L);
        when(target.mimeType()).thenReturn("video/mp4");
        when(contenidoService.resolveStreamingTarget(any(), any(), any())).thenReturn(target);

        ResponseEntity<Void> resp = controller.head("id", null, null, null);
        assertEquals(200, resp.getStatusCodeValue());
        assertEquals("bytes", resp.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES));
    }

    @Test
    void testModificarContenido() throws Throwable {
        ModificarContenidoRequest req = new ModificarContenidoRequest();
        when(contenidoService.modificarContenido(anyString(), any(), any())).thenReturn(contenido);

        ResponseEntity<Contenido> resp = controller.modificarContenido("id", req, "user@mail.com", "VIDEO");
        assertEquals(200, resp.getStatusCodeValue());
        assertEquals("Test Video", resp.getBody().getTitulo());
    }

    @Test
    void testEliminarContenido() {
        doNothing().when(contenidoService).eliminarContenido(anyString(), any());
        ResponseEntity<Void> resp = controller.eliminarContenido("id", "user@mail.com", "VIDEO");
        assertEquals(204, resp.getStatusCodeValue());
    }

    @Test
    void testValorarContenido() {
        Map<String,Object> map = Map.of("score", 5);
        when(contenidoService.rateContenido(anyString(), anyString(), anyDouble())).thenReturn(map);

        ResponseEntity<Map<String,Object>> resp = controller.valorarContenido("id", 5.0, "user@mail.com");
        assertEquals(200, resp.getStatusCodeValue());
        assertEquals(map, resp.getBody());
    }

    @Test
    void testRatingContenido() {
        Map<String,Object> map = Map.of("avg", 4.5);
        when(contenidoService.ratingResumen(anyString())).thenReturn(map);

        ResponseEntity<Map<String,Object>> resp = controller.ratingContenido("id");
        assertEquals(200, resp.getStatusCodeValue());
        assertEquals(map, resp.getBody());
    }

    @Test
    void testAddFavorito() {
        doNothing().when(contenidoService).addFavorito(anyString(), anyString(), anyString());
        ResponseEntity<Void> resp = controller.addFavorito("c1", "user@mail.com", "USER");
        assertEquals(201, resp.getStatusCodeValue());
        assertTrue(resp.getHeaders().getLocation().toString().endsWith("/c1/favorito"));
    }

    @Test
    void testRemoveFavorito() {
        doNothing().when(contenidoService).removeFavorito(anyString(), anyString());
        ResponseEntity<Void> resp = controller.removeFavorito("c1", "user@mail.com");
        assertEquals(204, resp.getStatusCodeValue());
    }

    @Test
    void testListFavoritos() {
        when(contenidoService.listFavoritosIds("user@mail.com")).thenReturn(List.of("c1", "c2"));
        ResponseEntity<List<String>> resp = controller.listFavoritos("user@mail.com");
        assertEquals(List.of("c1", "c2"), resp.getBody());
    }

    @Test
    void testResolveAgeAndMediaTypeAndCommonHeaders() throws Exception {
        assertEquals(25, controller.resolveAge(null, 25));
        assertNull(controller.resolveAge("invalid", null));

        Path tmp = Files.createTempFile("test", ".txt");
        assertEquals(MediaType.TEXT_PLAIN, controller.resolveMediaType(null, tmp));
        Files.delete(tmp);

        HttpHeaders h = controller.commonHeaders(MediaType.APPLICATION_JSON);
        assertEquals(MediaType.APPLICATION_JSON, h.getContentType());
    }

    @Test
    void testResolveEmailWithHeader() {
        String email = controller.resolveEmail("header@mail.com");
        assertEquals("header@mail.com", email);
    }
}
