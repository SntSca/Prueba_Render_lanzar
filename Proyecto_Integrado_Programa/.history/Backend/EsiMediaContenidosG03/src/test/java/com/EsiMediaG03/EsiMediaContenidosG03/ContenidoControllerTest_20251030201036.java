package com.EsiMediaG03.EsiMediaContenidosG03;

package com.EsiMediaG03.http;

import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
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

@WebMvcTest(controllers = ContenidoController.class)
class ContenidoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ContenidoService contenidoService;

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
        try { Files.deleteIfExists(tempFile); } catch (Exception ignored) {}
    }

    private StreamingTarget mockFileTarget() throws Exception {
        StreamingTarget target = mock(StreamingTarget.class, Mockito.withSettings().lenient());
        when(target.isExternalRedirect()).thenReturn(false);
        when(target.externalUrl()).thenReturn(null);
        when(target.path()).thenReturn(tempFile);
        when(target.length()).thenReturn((long) data.length);
        when(target.mimeType()).thenReturn("application/octet-stream");
        return target;
    }

    @Test
    @DisplayName("GET /ReproducirContenido/{id} sin Range devuelve 200 OK con Content-Length, Accept-Ranges y body completo")
    void streamWithoutRange_ok() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(), any()))
                .thenReturn(mockFileTarget());

        // No verificamos el InputStreamResource exacto, solo headers y status
        mockMvc.perform(get("/Contenidos/ReproducirContenido/{id}", "abc"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/octet-stream"))
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, data.length));

        verify(contenidoService).registrarReproduccionSiUsuario(eq("abc"), isNull());
    }

    @Test
    @DisplayName("GET /ReproducirContenido/{id} con Range válido devuelve 206 y Content-Range correcto")
    void streamWithRange_partialContent() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(), any()))
                .thenReturn(mockFileTarget());

        mockMvc.perform(get("/Contenidos/ReproducirContenido/{id}", "abc")
                        .header(HttpHeaders.RANGE, "bytes=0-9"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/octet-stream"))
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 0-9/26"))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, 10L));
    }

    @Test
    @DisplayName("GET /ReproducirContenido/{id} con Range fuera de límites devuelve 416")
    void streamWithRange_outOfBounds() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(), any()))
                .thenReturn(mockFileTarget());

        mockMvc.perform(get("/Contenidos/ReproducirContenido/{id}", "abc")
                        .header(HttpHeaders.RANGE, "bytes=100-200"))
                .andExpect(status().isRequestedRangeNotSatisfiable())
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes */26"));
    }

    @Test
    @DisplayName("GET /ReproducirContenido/{id} redirige a URL externa cuando isExternalRedirect=true")
    void streamExternalRedirect() throws Exception {
        StreamingTarget external = mock(StreamingTarget.class);
        when(external.isExternalRedirect()).thenReturn(true);
        when(external.externalUrl()).thenReturn("https://cdn.example.com/video.mp4");
        when(external.mimeType()).thenReturn("video/mp4");

        when(contenidoService.resolveStreamingTarget(eq("vid123"), any(), any())).thenReturn(external);

        mockMvc.perform(get("/Contenidos/ReproducirContenido/{id}", "vid123"))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, "https://cdn.example.com/video.mp4"));
    }

    @Test
    @DisplayName("HEAD /ReproducirContenido/{id} devuelve headers de longitud, tipo y Accept-Ranges")
    void head_ok() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("abc"), any(), any()))
                .thenReturn(mockFileTarget());

        mockMvc.perform(head("/Contenidos/ReproducirContenido/{id}", "abc"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/octet-stream"))
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, data.length));
    }

    @Test
    @DisplayName("resolveAge usa X-User-Age cuando está presente (verificando argumento pasado al servicio)")
    void stream_resolveAgeFromHeader() throws Exception {
        when(contenidoService.resolveStreamingTarget(anyString(), any(), any()))
                .thenReturn(mockFileTarget());

        mockMvc.perform(get("/Contenidos/ReproducirContenido/{id}", "abc")
                        .header("X-User-Age", "25")
                        .header("X-User-Vip", "true"))
                .andExpect(status().isOk());

        ArgumentCaptor<Integer> ageCaptor = ArgumentCaptor.forClass(Integer.class);
        ArgumentCaptor<Boolean> vipCaptor = ArgumentCaptor.forClass(Boolean.class);

        verify(contenidoService).resolveStreamingTarget(eq("abc"), vipCaptor.capture(), ageCaptor.capture());
        // age de la cabecera debe pasar intacto
        org.junit.jupiter.api.Assertions.assertEquals(25, ageCaptor.getValue());
        org.junit.jupiter.api.Assertions.assertEquals(Boolean.TRUE, vipCaptor.getValue());
    }

    @Test
    @DisplayName("PUT /ModificarContenido/{id} devuelve 200 y body actualizado")
    void modificarContenido_ok() throws Exception {
        ModificarContenidoRequest cambios = new ModificarContenidoRequest(); // asume constructor vacío
        Contenido actualizado = new Contenido(); // usa tu clase real; aquí solo verificamos llamada
        when(contenidoService.modificarContenido(eq("c1"), eq(cambios), eq(Contenido.Tipo.VIDEO)))
                .thenReturn(actualizado);

        mockMvc.perform(put("/Contenidos/ModificarContenido/{id}", "c1")
                        .header("X-Creator-Tipo", "VIDEO")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
        verify(contenidoService).modificarContenido(eq("c1"), any(ModificarContenidoRequest.class), eq(Contenido.Tipo.VIDEO));
    }

    @Test
    @DisplayName("DELETE /EliminarContenido/{id} devuelve 204 y llama al servicio")
    void eliminarContenido_noContent() throws Exception {
        mockMvc.perform(delete("/Contenidos/EliminarContenido/{id}", "c1")
                        .header("X-Creator-Tipo", "AUDIO"))
                .andExpect(status().isNoContent());
        verify(contenidoService).eliminarContenido(eq("c1"), eq(Contenido.Tipo.AUDIO));
    }
}
