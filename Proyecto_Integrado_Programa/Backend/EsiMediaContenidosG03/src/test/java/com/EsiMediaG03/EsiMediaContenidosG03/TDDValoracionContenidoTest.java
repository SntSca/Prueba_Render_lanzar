package com.EsiMediaG03.EsiMediaContenidosG03;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.exceptions.ContenidoException;
import com.EsiMediaG03.exceptions.ContenidoValidationException;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@ExtendWith(MockitoExtension.class)
class TDDValoracionContenidoTest {


    @Mock ContenidoDAO contenidoDAO;
    @Mock MongoTemplate mongoTemplate;
    @InjectMocks ContenidoService serviceUnderTest;

    @Mock ContenidoService contenidoServiceMock;
    @InjectMocks ContenidoController controllerUnderTest;

    private Contenido contenido;

    @BeforeEach
    void baseInit() {
        contenido = new Contenido();
        try {
            var idField = Contenido.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(contenido, "C1");
        } catch (Exception ignored) {}

        
        contenido.setReproductores(new HashSet<>(List.of("user@esi.com")));

    
        contenido.setRatings(new HashMap<>()); 
        contenido.setRatingAvg(0.0);
        contenido.setRatingCount(0);
    }

    @Nested
    @DisplayName("ContenidoService - Rating")
    class ServiceRatingTests {

        @BeforeEach
        void initServiceStubs() {
        
            lenient().when(contenidoDAO.findById("C1")).thenReturn(Optional.of(contenido));
        }

        @Test
        @DisplayName("Primera valoración (4.5) -> count=1 y avg=4.5")
        void primerVoto_ok() {
            when(contenidoDAO.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Map<String,Object> res = serviceUnderTest.rateContenido("C1", "user@esi.com", 4.5);
            assertEquals(1, res.get("count"));
            assertEquals(4.5, (double)res.get("avg"), 1e-9);
            verify(contenidoDAO, times(1)).save(any());
        }

        @Test
        @DisplayName("Duplicado: el mismo usuario no puede volver a valorar")
        void votoDuplicado_noPermitido() {
            when(contenidoDAO.save(any())).thenAnswer(inv -> inv.getArgument(0));

        
            serviceUnderTest.rateContenido("C1", "user@esi.com", 3.0);

            
            assertThrows(ContenidoException.class,
                    () -> serviceUnderTest.rateContenido("C1", "user@esi.com", 5.0));

    
            verify(contenidoDAO, times(1)).save(any());
        }

        @Test
        @DisplayName("Score fuera de rango (0.5 y 5.5) -> ContenidoValidationException")
        void scoreInvalido_rango() {
            assertThrows(ContenidoValidationException.class,
                    () -> serviceUnderTest.rateContenido("C1", "user@esi.com", 0.0));
            assertThrows(ContenidoValidationException.class,
                    () -> serviceUnderTest.rateContenido("C1", "user@esi.com", 5.5));
        }

        @Test
        @DisplayName("Score no múltiplo de 0.5 (4.3) -> ContenidoValidationException")
        void scoreInvalido_noMultiplo() {
            assertThrows(ContenidoValidationException.class,
                    () -> serviceUnderTest.rateContenido("C1", "user@esi.com", 4.3));
        }

        @Test
        @DisplayName("Usuario no reprodujo -> ContenidoException")
        void noReprodujo_forbidden() {
            assertThrows(ContenidoException.class,
                    () -> serviceUnderTest.rateContenido("C1", "otro@esi.com", 4.0));
            verify(contenidoDAO, never()).save(any());
        }

        @Test
        @DisplayName("Resumen -> devuelve count y avg")
        void resumen_ok() {
            when(contenidoDAO.save(any())).thenAnswer(inv -> inv.getArgument(0));

            serviceUnderTest.rateContenido("C1", "user@esi.com", 4.0);
            Map<String,Object> res = serviceUnderTest.ratingResumen("C1");
            assertEquals(1, res.get("count"));
            assertEquals(4.0, (double)res.get("avg"), 1e-9);
        }
    }

    @Nested
    @DisplayName("ContenidoController - Endpoints de rating")
    class ControllerRatingTests {

        @Test
        @DisplayName("POST /ValorarContenido/{id}/{score} (4.5) -> 200 con avg y count")
        void postValorar_ok() {
            Map<String, Object> mockRes = new HashMap<>();
            mockRes.put("avg", 4.5);
            mockRes.put("count", 2);
            mockRes.put("ratings", Map.of("user@esi.com", 4.5, "otro@esi.com", 4.5));

            when(contenidoServiceMock.rateContenido("C1", "user@esi.com", 4.5)).thenReturn(mockRes);

            ResponseEntity<Map<String,Object>> resp =
                    controllerUnderTest.valorarContenido("C1", 4.5, "user@esi.com");

            assertEquals(HttpStatus.OK, resp.getStatusCode());
            assertEquals(4.5, (double)resp.getBody().get("avg"), 1e-9);
            assertEquals(2, resp.getBody().get("count"));
        }

        @Test
        @DisplayName("GET /RatingContenido/{id} -> 200 con avg y count")
        void getRating_ok() {
            Map<String, Object> mockRes = new HashMap<>();
            mockRes.put("avg", 3.5);
            mockRes.put("count", 4);

            when(contenidoServiceMock.ratingResumen("C1")).thenReturn(mockRes);

            ResponseEntity<Map<String,Object>> resp = controllerUnderTest.ratingContenido("C1");
            assertEquals(HttpStatus.OK, resp.getStatusCode());
            assertEquals(3.5, (double)resp.getBody().get("avg"), 1e-9);
            assertEquals(4, resp.getBody().get("count"));
        }
    }
}
