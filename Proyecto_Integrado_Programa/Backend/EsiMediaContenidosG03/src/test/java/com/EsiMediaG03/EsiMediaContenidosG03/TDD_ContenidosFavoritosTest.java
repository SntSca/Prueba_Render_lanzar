package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ListaPublicaDAO;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.model.ListaPublica;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TDD_ContenidosFavoritosTest {

    @Mock
    MongoTemplate mongoTemplate;

    @Mock
    ListaPublicaDAO listaPublicaDAO;

    @InjectMocks
    ContenidoService service;

    private static final String EMAIL_USUARIO = "user@example.com";
    private static final String EMAIL_GESTOR  = "gestor@example.com";
    private static final String EMAIL_ADMIN   = "admin@example.com";
    
    private static final String ROLE_USUARIO = "USUARIO";
    private static final String ROLE_GESTOR  = "GESTOR_CONTENIDO";
    private static final String ROLE_ADMIN   = "ADMINISTRADOR";

    @Test
    @DisplayName("addFavorito OK -> header role=USUARIO y política permite (sin listas privadas)")
    void addFavorito_ok() {
        when(mongoTemplate.findById("CNT-123", Contenido.class)).thenReturn(new Contenido());
        when(listaPublicaDAO.findByContenidosIds("CNT-123")).thenReturn(List.of()); // no privadas

        service.addFavorito("CNT-123", EMAIL_USUARIO, ROLE_USUARIO);

        verify(mongoTemplate, times(1)).updateFirst(any(Query.class), any(), eq(Contenido.class));
        verifyNoMoreInteractions(mongoTemplate);
    }

    @Test
    @DisplayName("addFavorito FORBIDDEN -> política: contenido en una ListaPublica privada")
    void addFavorito_forbidden_policy() {
        when(mongoTemplate.findById("CNT-PRIV", Contenido.class)).thenReturn(new Contenido());
        ListaPublica privada = new ListaPublica(); privada.setPublica(false);
        when(listaPublicaDAO.findByContenidosIds("CNT-PRIV")).thenReturn(List.of(privada));

        assertThrows(AccessDeniedException.class,
            () -> service.addFavorito("CNT-PRIV", EMAIL_USUARIO, ROLE_USUARIO));

        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(), eq(Contenido.class));
    }

    @Test
    @DisplayName("addFavorito FORBIDDEN -> header role=GESTOR_CONTENIDO")
    void addFavorito_forbidden_gestor() {
        assertThrows(AccessDeniedException.class,
            () -> service.addFavorito("CNT-999", EMAIL_GESTOR, ROLE_GESTOR));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(), eq(Contenido.class));
        verifyNoInteractions(listaPublicaDAO);
    }

    @Test
    @DisplayName("addFavorito FORBIDDEN -> header role=ADMINISTRADOR")
    void addFavorito_forbidden_admin() {
        assertThrows(AccessDeniedException.class,
            () -> service.addFavorito("CNT-777", EMAIL_ADMIN, ROLE_ADMIN));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(), eq(Contenido.class));
        verifyNoInteractions(listaPublicaDAO);
    }

    @Test
    @DisplayName("removeFavorito -> idempotente ($pull); no falla si no estaba")
    void removeFavorito_ok() {
        service.removeFavorito("CNT-XYZ", EMAIL_USUARIO);
        verify(mongoTemplate, times(1)).updateFirst(any(Query.class), any(), eq(Contenido.class));
    }

    @Test
    @DisplayName("listFavoritosIds -> devuelve IDs en el orden obtenido")
    void listFavoritos_returnsIds() {
        Contenido cA = mock(Contenido.class); when(cA.getId()).thenReturn("C3");
        Contenido cB = mock(Contenido.class); when(cB.getId()).thenReturn("C2");
        Contenido cC = mock(Contenido.class); when(cC.getId()).thenReturn("C1");
        when(mongoTemplate.find(any(Query.class), eq(Contenido.class))).thenReturn(List.of(cA, cB, cC));

        List<String> ids = service.listFavoritosIds(EMAIL_USUARIO);

        assertEquals(List.of("C3","C2","C1"), ids);
    }
}
