package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT) 
class ContenidoControllerTest {

    @Mock
    ContenidoService contenidoService;

    @InjectMocks
    ContenidoController controller;

    private Path tempFile;
    private byte[] data;

    @BeforeEach
    void setUp() throws Exception {
        data = "abcdefghijklmnopqrstuvwxyz".getBytes(); // 26 bytes
        tempFile = Files.createTempFile("contenido-test-", ".bin");
        Files.write(tempFile, data);
    }

    @AfterEach
    void tearDown() throws Exception {
        Files.deleteIfExists(tempFile);
    }

    private StreamingTarget mockFileTarget() {
        StreamingTarget t = mock(StreamingTarget.class, withSettings().lenient());
        when(t.isExternalRedirect()).thenReturn(false);
        when(t.externalUrl()).thenReturn(null);
        when(t.path()).thenReturn(tempFile);
        when(t.length()).thenReturn((long) data.length);
        when(t.mimeType()).thenReturn("application/octet-stream");
        return t;
    }

    private static byte[] readAll(InputStream is) throws Exception {
        return is.readAllBytes();
    }



    @Test
    void stream_redireccionExterna_302() throws Exception {
    // Simulamos contenido externo
    StreamingTarget externalTarget = mock(StreamingTarget.class);
    when(externalTarget.isExternalRedirect()).thenReturn(true);
    when(externalTarget.externalUrl()).thenReturn("https://cdn.example.com/audio.mp3");

    // Mock del servicio
    when(contenidoService.resolveStreamingTarget(anyString(), anyBoolean(), anyInt()))
            .thenReturn(externalTarget);

    mvc.perform(get("/contenido/ReproducirContenido/123")
                    .param("vip", "false")
                    .param("edad", "25"))
            .andExpect(status().isFound())  // 302
            .andExpect(header().string(HttpHeaders.LOCATION, "https://cdn.example.com/audio.mp3"));
}



   

    @Test
    @DisplayName("PUT /ModificarContenido/{id} -> 200 OK y llamada al servicio con tipo correcto")
    void modificarContenido_ok() throws Throwable {
        ModificarContenidoRequest cambios = new ModificarContenidoRequest();
        Contenido actualizado = new Contenido();

        when(contenidoService.modificarContenido(eq("c1"), eq(cambios), eq(Contenido.Tipo.VIDEO)))
                .thenReturn(actualizado);

        ResponseEntity<Contenido> resp = controller.modificarContenido("c1", cambios, null, "VIDEO");

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertSame(actualizado, resp.getBody());
        verify(contenidoService).modificarContenido("c1", cambios, Contenido.Tipo.VIDEO);
    }

    @Test
    @DisplayName("DELETE /EliminarContenido/{id} -> 204 No Content y llamada al servicio")
    void eliminarContenido_noContent() {
        ResponseEntity<Void> resp = controller.eliminarContenido("c1", null, "AUDIO");

        assertEquals(HttpStatus.NO_CONTENT, resp.getStatusCode());
        verify(contenidoService).eliminarContenido("c1", Contenido.Tipo.AUDIO);
    }
}
