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


}
