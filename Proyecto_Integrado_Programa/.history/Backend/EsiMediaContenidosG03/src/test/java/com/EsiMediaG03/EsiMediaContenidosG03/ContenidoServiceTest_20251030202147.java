package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.exceptions.ContenidoAddException;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
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

    @Test
    @DisplayName("Tipo null -> ContenidoAddException")
    void tipo_null_lanza() {
        Contenido c = baseAudio();
        c.setTipo(null);

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("tipo"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("AUDIO sin ficheroAudio -> ContenidoAddException")
    void audio_sin_fichero_lanza() {
        Contenido c = baseAudio();
        c.setFicheroAudio("   ");

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("audio"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("VIDEO sin urlVideo -> ContenidoAddException")
    void video_sin_url_lanza() {
        Contenido c = baseVideo("1080p");
        c.setUrlVideo("   ");

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("url"));
        verify(contenidoDAO, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"144p", "360p", "8k", "ultra", "1080"})
    @DisplayName("VIDEO con resolución inválida -> ContenidoAddException")
    void video_resolucion_invalida(String reso) {
        Contenido c = baseVideo(reso);

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("resolución"));
        verify(contenidoDAO, never()).save(any());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    @DisplayName("Título null/blank -> ContenidoAddException")
    void titulo_invalido_lanza(String titulo) {
        Contenido c = baseAudio();
        c.setTitulo(titulo);

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("título"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("Tags null -> ContenidoAddException")
    void tags_null_lanza() {
        Contenido c = baseAudio();
        c.setTags(null);

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("tag"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("Tags vacíos -> ContenidoAddException")
    void tags_vacios_lanza() {
        Contenido c = baseAudio();
        c.setTags(Collections.emptyList());

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("tag"));
        verify(contenidoDAO, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, -30})
    @DisplayName("Duración <= 0 -> ContenidoAddException")
    void duracion_no_positiva_lanza(int mins) {
        Contenido c = baseAudio();
        c.setDuracionMinutos(mins);

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("duración"));
        verify(contenidoDAO, never()).save(any());
    }

    @Nested
    @DisplayName("Modelo Contenido")
    class ContenidoModelTest {

        @Test
        @DisplayName("setVisible actualiza fechaEstado a 'ahora'")
        void setVisible_actualiza_fechaEstado() {
            Contenido c = new Contenido();
            LocalDateTime t0 = c.getFechaEstado();
            assertNotNull(t0);

            c.setVisible(true);
            LocalDateTime t1 = c.getFechaEstado();
            assertNotNull(t1);
            assertNotEquals(t0, t1);
            assertTrue(!t1.isBefore(t0));
        }
    }
}
