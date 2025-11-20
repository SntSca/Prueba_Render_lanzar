package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class ContenidoControllerTest {

    @Mock
    private ContenidoService contenidoService;

    @InjectMocks
    private ContenidoController controller;

    private Path temp;
    private byte[] data;

    @BeforeEach
    void setUp() throws Exception {
        data = "abcdefghijklmnopqrstuvwxyz".getBytes(); // 26 bytes
        temp = Files.createTempFile("contenido-test-", ".bin");
        Files.write(temp, data);
    }

    @AfterEach
    void tearDown() throws Exception {
        Files.deleteIfExists(temp);
    }

    private StreamingTarget mockFileTarget() {
        StreamingTarget t = mock(StreamingTarget.class, withSettings().lenient());
        when(t.isExternalRedirect()).thenReturn(false);
        when(t.path()).thenReturn(temp);
        when(t.length()).thenReturn((long) data.length);
        when(t.mimeType()).thenReturn("application/octet-stream");
        return t;
    }

    @Test
    void stream_sinRange_ok() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(Boolean.class), any()))
                .thenReturn(mockFileTarget());

        HttpHeaders h = new HttpHeaders();
        ResponseEntity<Object> resp = controller.stream("abc", h, null, null, null, null, null);

        Assertions.assertEquals(HttpStatus.OK, resp.getStatusCode());
        Assertions.assertEquals("application/octet-stream", resp.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
        Assertions.assertEquals("bytes", resp.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES));
        Assertions.assertEquals(26, resp.getHeaders().getContentLength());
        verify(contenidoService).registrarReproduccionSiUsuario("abc", null);
    }

    @Test
    void stream_conRange_206() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(Boolean.class), any()))
                .thenReturn(mockFileTarget());

        HttpHeaders h = new HttpHeaders();
        h.add(HttpHeaders.RANGE, "bytes=0-9");
        ResponseEntity<Object> resp = controller.stream("abc", h, null, null, null, null, null);

        Assertions.assertEquals(HttpStatus.PARTIAL_CONTENT, resp.getStatusCode());
        Assertions.assertEquals("bytes 0-9/26", resp.getHeaders().getFirst(HttpHeaders.CONTENT_RANGE));
        Assertions.assertEquals(10L, resp.getHeaders().getContentLength());
    }

    @Test
    void stream_fueraDeRango_416() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(Boolean.class), any()))
                .thenReturn(mockFileTarget());

        HttpHeaders h = new HttpHeaders();
        h.add(HttpHeaders.RANGE, "bytes=100-200");
        ResponseEntity<Object> resp = controller.stream("abc", h, null, null, null, null, null);

        Assertions.assertEquals(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, resp.getStatusCode());
        Assertions.assertEquals("bytes */26", resp.getHeaders().getFirst(HttpHeaders.CONTENT_RANGE));
        Assertions.assertNull(resp.getBody());
    }

    @Test
    void stream_redireccionExterna_302() throws Exception {
        StreamingTarget ext = mock(StreamingTarget.class);
        when(ext.isExternalRedirect()).thenReturn(true);
        when(ext.externalUrl()).thenReturn("https://cdn.example.com/video.mp4");
        when(ext.mimeType()).thenReturn("video/mp4");
        when(contenidoService.resolveStreamingTarget(eq("vid123"), any(Boolean.class), any()))
                .thenReturn(ext);

        ResponseEntity<Object> resp = controller.stream("vid123", new HttpHeaders(), null, null, null, null, null);
        Assertions.assertEquals(HttpStatus.FOUND, resp.getStatusCode());
        Assertions.assertEquals("https://cdn.example.com/video.mp4", resp.getHeaders().getFirst(HttpHeaders.LOCATION));
    }

    @Test
    void head_ok() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(Boolean.class), any()))
                .thenReturn(mockFileTarget());

        ResponseEntity<Void> resp = controller.head("abc", null, null, null);
        Assertions.assertEquals(HttpStatus.OK, resp.getStatusCode());
        Assertions.assertEquals("application/octet-stream", resp.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
        Assertions.assertEquals("bytes", resp.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES));
        Assertions.assertEquals("26", resp.getHeaders().getFirst(HttpHeaders.CONTENT_LENGTH));
    }

    @Test
    void modificarContenido_ok() throws Throwable {
        ModificarContenidoRequest cambios = new ModificarContenidoRequest();
        Contenido actualizado = new Contenido();
        when(contenidoService.modificarContenido(eq("c1"), eq(cambios), eq(Contenido.Tipo.VIDEO)))
                .thenReturn(actualizado);

        ResponseEntity<Contenido> resp = controller.modificarContenido("c1", cambios, null, "VIDEO");
        Assertions.assertEquals(HttpStatus.OK, resp.getStatusCode());
        Assertions.assertSame(actualizado, resp.getBody());
        verify(contenidoService).modificarContenido("c1", cambios, Contenido.Tipo.VIDEO);
    }

    @Test
    void eliminarContenido_noContent() {
        ResponseEntity<Void> resp = controller.eliminarContenido("c1", null, "AUDIO");
        Assertions.assertEquals(HttpStatus.NO_CONTENT, resp.getStatusCode());
        verify(contenidoService).eliminarContenido("c1", Contenido.Tipo.AUDIO);
    }
}
