package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ContenidoDAO;
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
        Contenido c = baseVideo(reso);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("resolución"));
        verify(contenidoDAO, never()).save(any());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    @DisplayName("Título null/blank -> IllegalArgumentException")
    void titulo_invalido_lanza(String titulo) {
        Contenido c = baseAudio();
        c.setTitulo(titulo);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("título"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("Tags null -> IllegalArgumentException")
    void tags_null_lanza() {
        Contenido c = baseAudio();
        c.setTags(null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("tag"));
        verify(contenidoDAO, never()).save(any());
    }

    @Test
    @DisplayName("Tags vacíos -> IllegalArgumentException")
    void tags_vacios_lanza() {
        Contenido c = baseAudio();
        c.setTags(Collections.emptyList());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("tag"));
        verify(contenidoDAO, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, -30})
    @DisplayName("Duración <= 0 -> IllegalArgumentException")
    void duracion_no_positiva_lanza(int mins) {
        Contenido c = baseAudio();
        c.setDuracionMinutos(mins);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.anadirContenido(c));
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
    @Nested
    @DisplayName("Contenido Tipo enum")
    class ContenidoTipoEnumTest {
        @Test
        @DisplayName("fromString reconoce valores válidos (case insensitive)")
        void fromString_valores_validos() {
            assertEquals(Contenido.Tipo.AUDIO, Contenido.Tipo.fromString("AUDIO"));
            assertEquals(Contenido.Tipo.AUDIO, Contenido.Tipo.fromString("audio"));
            assertEquals(Contenido.Tipo.VIDEO, Contenido.Tipo.fromString("VIDEO"));
            assertEquals(Contenido.Tipo.VIDEO, Contenido.Tipo.fromString("video"));
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "   ", "audios", "vid", "movie", "123"})
        @DisplayName("fromString con valor inválido -> IllegalArgumentException")
        void fromString_valor_invalido_lanza(String val) {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> Contenido.Tipo.fromString(val));
            assertTrue(ex.getMessage().toLowerCase().contains("tipo"));
        }
    }
}
