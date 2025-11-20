package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.model.Contenido;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitarios de ContenidoService y parte del modelo Contenido.
 */
@ExtendWith(MockitoExtension.class)
class ContenidoServiceTest {

    @Mock
    ContenidoDAO contenidoDAO;

    @InjectMocks
    ContenidoService service;

    private static Contenido baseAudio() {
        Contenido c = new Contenido();
        c.setTipo(Contenido.Tipo.AUDIO);
        c.setTitulo("Mi audio");
        c.setTags(List.of("tag1"));
        c.setDuracionMinutos(3);
        c.setFicheroAudio("/path/audio.mp3");
        return c;
    }

    private static Contenido baseVideo(String resolucion) {
        Contenido c = new Contenido();
        c.setTipo(Contenido.Tipo.VIDEO);
        c.setTitulo("Mi vídeo");
        c.setTags(List.of("tag1"));
        c.setDuracionMinutos(5);
        c.setUrlVideo("https://video.example/video-1");
        c.setResolucion(resolucion);
        return c;
    }

    // -------------- Casos OK --------------

    @Test
    @DisplayName("AUDIO válido -> guarda y devuelve contenido")
    void anadirContenido_audio_ok() throws Throwable {
        Contenido c = baseAudio();
        when(contenidoDAO.save(any(Contenido.class))).thenAnswer(inv -> inv.getArgument(0));

        Contenido res = service.anadirContenido(c);

        assertSame(c, res);
        verify(contenidoDAO).save(c);
    }

    @ParameterizedTest
    @ValueSource(strings = {"720p", "1080p", "4k", "4K"})
    @DisplayName("VIDEO válido (resoluciones permitidas) -> guarda y devuelve")
    void anadirContenido_video_ok_resoluciones(String reso) throws Throwable {
        Contenido c = baseVideo(reso);
        when(contenidoDAO.save(any(Contenido.class))).thenAnswer(inv -> inv.getArgument(0));

        Contenido out = service.anadirContenido(c);

        assertSame(c, out);
        verify(contenidoDAO).save(c);
    }

    // -------------- Validaciones / errores --------------

    @Test
    @DisplayName("Tipo null -> IllegalArgumentException")
    void tipo_null_lanza() {
        Contenido c = baseAudio();
        c.setTipo(null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("tipo"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("AUDIO sin ficheroAudio -> IllegalArgumentException")
    void audio_sin_fichero_lanza() {
        Contenido c = baseAudio();
        c.setFicheroAudio("   ");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("audio"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("VIDEO sin urlVideo -> IllegalArgumentException")
    void video_sin_url_lanza() {
        Contenido c = baseVideo("1080p");
        c.setUrlVideo("   ");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("url"));
        verify(contenidoDAO, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"144p", "360p", "8k", "ultra", "1080"}) // formatos no admitidos por el regex
    @DisplayName("VIDEO con resolución inválida -> IllegalArgumentException")
    void video_resolucion_invalida(String reso) {
        Contenido c = baseVideo(reso
