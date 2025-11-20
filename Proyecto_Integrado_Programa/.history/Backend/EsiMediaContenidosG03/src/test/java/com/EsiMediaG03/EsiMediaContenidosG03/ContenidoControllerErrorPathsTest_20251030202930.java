package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.exceptions.ContenidoModificationException;
import com.EsiMediaG03.exceptions.StreamingTargetResolutionException;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.nio.file.Path;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContenidoControllerErrorPathsTest {

    @Mock
    ContenidoService contenidoService;

    @InjectMocks
    ContenidoController controller;

    // ===== Helpers: Crea instancias REALES de StreamingTarget (ajusta firma si difiere) =====
    private StreamingTarget externalTarget(String url, String mime) {
        return new StreamingTarget(
                null,                 // path
                0L,                   // length
                Objects.requireNonNullElse(mime, "video/mp4"),
                false, url                   // externalUrl -> redirección
        );
    }

    private StreamingTarget localTarget(Path path, long length, String mime) {
        return new StreamingTarget(path, length, mime, false, null);
    }

    // =================== TESTS ===================

    @Test
    @DisplayName("stream(): si falla resolveStreamingTarget -> propaga StreamingTargetResolutionException")
    void stream_falla_resolucion_propagada() throws Exception {
        when(contenidoService.resolveStreamingTarget(anyString(), any(), any()))
                .thenThrow(new StreamingTargetResolutionException("no se puede resolver"));

        assertThrows(StreamingTargetResolutionException.class, () ->
                controller.stream("id-x", new HttpHeaders(), null, null, null, null, null));

        verify(contenidoService, never()).registrarReproduccionSiUsuario(anyString(), any());
    }

    @Test
    @DisplayName("head(): si falla resolveStreamingTarget -> propaga StreamingTargetResolutionException")
    void head_falla_resolucion_propagada() throws Exception {
        when(contenidoService.resolveStreamingTarget(anyString(), any(), any()))
                .thenThrow(new StreamingTargetResolutionException("no se puede resolver"));

        assertThrows(StreamingTargetResolutionException.class, () ->
                controller.head("id-x", null, null, null));
    }

    @Test
    @DisplayName("head() con target externo -> 200 OK y Content-Type desde mime; sin Content-Length ni Accept-Ranges")
    void head_externo_ok() throws Exception {
        when(contenidoService.resolveStreamingTarget(eq("vid-ext"), any(), any()))
                .thenReturn(externalTarget("https://cdn.example.com/video.mp4", "video/mp4"));

        ResponseEntity<Void> resp = controller.head("vid-ext", null, null, null);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals("video/mp4", resp.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
        assertNull(resp.getHeaders().getFirst(HttpHeaders.CONTENT_LENGTH));
        assertNull(resp.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES));
    }

    @Test
    @DisplayName("modificarContenido(): si servicio lanza ContenidoModificationException -> se propaga")
    void modificarContenido_error_propagado() throws Throwable {
        ModificarContenidoRequest cambios = new ModificarContenidoRequest();
        doThrow(new ContenidoModificationException("cambio inválido"))
                .when(contenidoService)
                .modificarContenido(eq("c1"), eq(cambios), eq(Contenido.Tipo.VIDEO));

        assertThrows(ContenidoModificationException.class, () ->
                controller.modificarContenido("c1", cambios, null, "VIDEO"));
    }
}
