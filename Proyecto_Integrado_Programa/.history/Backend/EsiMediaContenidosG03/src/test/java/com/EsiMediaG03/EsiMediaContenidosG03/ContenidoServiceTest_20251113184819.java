package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.exceptions.ContenidoAddException;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContenidoServiceTest {

    @Mock
    ContenidoDAO contenidoDAO;

    @Mock
    MongoTemplate mongoTemplate;

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

    // ====================== TESTS EXISTENTES ======================

    @Test
    void anadirContenido_audio_ok() throws Throwable {
        Contenido c = baseAudio();
        when(contenidoDAO.save(any(Contenido.class))).thenAnswer(inv -> inv.getArgument(0));

        Contenido res = service.anadirContenido(c);

        assertSame(c, res);
        verify(contenidoDAO).save(c);
    }

    @ParameterizedTest
    @ValueSource(strings = {"720p", "1080p", "4k", "4K"})
    void anadirContenido_video_ok_resoluciones(String reso) throws Throwable {
        Contenido c = baseVideo(reso);
        when(contenidoDAO.save(any(Contenido.class))).thenAnswer(inv -> inv.getArgument(0));

        Contenido out = service.anadirContenido(c);

        assertSame(c, out);
        verify(contenidoDAO).save(c);
    }

    @Test
    void tipo_null_lanza() {
        Contenido c = baseAudio();
        c.setTipo(null);

        ContenidoAddException ex = assertThrows(ContenidoAddException.class, () -> service.anadirContenido(c));
        assertTrue(ex.getMessage().toLowerCase().contains("tipo"));
        verify(contenidoDAO, never()).save(any());
    }

    // ... otros tests de validación (igual que antes) ...

    // ====================== TESTS ESTADISTICAS ======================

    @Test
    void estadisticasGlobales_devuelve_tres_listas() {
        when(mongoTemplate.find(any(Query.class), eq(Contenido.class)))
                .thenReturn(List.of(new Contenido()));

        Map<String, Object> res = service.estadisticasGlobales();

        assertTrue(res.containsKey("topReproducciones"));
        assertTrue(res.containsKey("topValoraciones"));
        assertTrue(res.containsKey("topCategorias"));
    }

    @Test
    void top5PorReproducciones_ok() {
        Contenido c1 = new Contenido();
        c1.setId("id1");
        c1.setTitulo("Uno");
        c1.setTipo(Contenido.Tipo.AUDIO);
        c1.setNumReproducciones(10L); // Asegúrate de usar Long

        Contenido c2 = new Contenido();
        c2.setId("id2");
        c2.setTitulo("Dos");
        c2.setTipo(Contenido.Tipo.VIDEO);
        c2.setNumReproducciones(5L);

        when(mongoTemplate.find(any(Query.class), eq(Contenido.class)))
                .thenReturn(List.of(c1, c2));

        Map<String, Object> res = service.estadisticasGlobales();
        List<Map<String, Object>> top = (List<Map<String, Object>>) res.get("topReproducciones");

        assertEquals("id1", top.get(0).get("id"));
        assertEquals(10L, top.get(0).get("reproducciones"));
    }


    @Test
    void top5PorValoraciones_filtra_ratingCount() {
        Contenido c1 = new Contenido();
        c1.setId("v1");
        c1.setTitulo("V1");
        c1.setTipo(Contenido.Tipo.VIDEO);
        c1.setRatingCount(2);
        c1.setRatingAvg(4.0);

        when(mongoTemplate.find(any(Query.class), eq(Contenido.class))).thenReturn(List.of(c1));

        Map<String, Object> res = service.estadisticasGlobales();
        List<Map<String, Object>> top = (List<Map<String, Object>>) res.get("topValoraciones");

        assertEquals(1, top.size());
        assertEquals("v1", top.get(0).get("id"));
        assertEquals(4.0, top.get(0).get("avg"));
    }

@Test
void top5CategoriasMasVistas_ok() {
    Contenido c1 = new Contenido();
    c1.setUserEmail("a@a.com");
    c1.setNumReproducciones(10L);

    Contenido c2 = new Contenido();
    c2.setUserEmail("b@b.com");
    c2.setNumReproducciones(20L);

    Document userA = new Document("email", "a@a.com").append("especialidad", "Informatica");
    Document userB = new Document("email", "b@b.com").append("especialidad", "Medicina");

    when(mongoTemplate.find(any(Query.class), eq(Contenido.class)))
            .thenReturn(List.of(c1, c2));
    when(mongoTemplate.find(any(Query.class), eq(Document.class), anyString()))
            .thenReturn(List.of(userA, userB));

    Map<String, Object> res = service.estadisticasGlobales();
    List<Map<String, Object>> top = (List<Map<String, Object>>) res.get("topCategorias");

    assertEquals(2, top.size());
    assertEquals("Medicina", top.get(0).get("especialidad"));
    assertEquals(20L, top.get(0).get("reproducciones"));      // <-- coincide con FIELD_REPRODUCCIONES
}
}
