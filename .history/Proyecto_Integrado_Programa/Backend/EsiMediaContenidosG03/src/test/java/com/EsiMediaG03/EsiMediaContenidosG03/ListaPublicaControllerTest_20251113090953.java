package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.http.ListaPublicaController;
import com.EsiMediaG03.model.ListaPublica;
import com.EsiMediaG03.services.ListaPublicaService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class ListaPublicaControllerTest {

    @Mock
    private ListaPublicaService listaService;

    @InjectMocks
    private ListaPublicaController controller;

    private MockMvc mvc;
    private final ObjectMapper om = new ObjectMapper();

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    @DisplayName("POST /listas -> crear lista")
    void crearLista_ok() throws Exception {
        ListaPublica lista = new ListaPublica();
        lista.setNombre("Mi lista");
        when(listaService.crearLista(any())).thenReturn(lista);

        mvc.perform(post("/listas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(lista)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Mi lista"));

        verify(listaService).crearLista(any());
    }

    @Test
    @DisplayName("GET /listas/publicas -> obtener listas públicas")
    void obtenerListasPublicas_ok() throws Exception {
        ListaPublica lista = new ListaPublica();
        lista.setNombre("Publica");
        when(listaService.obtenerListasPublicas()).thenReturn(List.of(lista));

        mvc.perform(get("/listas/publicas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("Publica"));
    }

    @Test
    @DisplayName("GET /listas/usuario/{email} -> listas por usuario")
    void obtenerListasPorUsuario_ok() throws Exception {
        ListaPublica lista = new ListaPublica();
        lista.setNombre("UsuarioLista");
        when(listaService.obtenerListasPorUsuario("user@mail.com"))
                .thenReturn(List.of(lista));

        mvc.perform(get("/listas/usuario/user@mail.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("UsuarioLista"));
    }

    @Test
    @DisplayName("GET /listas/{id} -> obtener lista por id")
    void obtenerListaPorId_ok() throws Exception {
        ListaPublica lista = new ListaPublica();
        lista.setNombre("ListaId");
        when(listaService.obtenerListaPorId("123")).thenReturn(Optional.of(lista));

        mvc.perform(get("/listas/123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("ListaId"));
    }

    @Test
    @DisplayName("PUT /listas/{id} -> actualizar lista")
    void actualizarLista_ok() throws Exception {
        ListaPublica updated = new ListaPublica();
        updated.setNombre("Actualizada");
        when(listaService.actualizarLista(eq("123"), any())).thenReturn(updated);

        mvc.perform(put("/listas/123")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(updated)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Actualizada"));
    }

    @Test
    @DisplayName("DELETE /listas/{id} -> eliminar lista")
    void eliminarLista_ok() throws Exception {
        doNothing().when(listaService).eliminarLista("123");

        mvc.perform(delete("/listas/123"))
                .andExpect(status().isOk());

        verify(listaService).eliminarLista("123");
    }

    @Test
    @DisplayName("POST /listas/{listaId}/contenidos/{contenidoId} -> añadir contenido")
    void anadirContenidoALista_ok() throws Exception {
        ListaPublica lista = new ListaPublica();
        lista.setNombre("ListaConContenido");
        when(listaService.anadirContenidoALista("l1", "c1")).thenReturn(lista);

        mvc.perform(post("/listas/l1/contenidos/c1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("ListaConContenido"));
    }

    @Test
    @DisplayName("DELETE /listas/{listaId}/contenidos/{contenidoId} -> eliminar contenido")
    void eliminarContenidoDeLista_ok() throws Exception {
        ListaPublica lista = new ListaPublica();
        lista.setNombre("ListaSinContenido");
        when(listaService.eliminarContenidoDeLista("l1", "c1")).thenReturn(lista);

        mvc.perform(delete("/listas/l1/contenidos/c1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("ListaSinContenido"));
    }

    @Test
    @DisplayName("POST /listas/mis-favoritos/init -> init mis favoritos")
    void initMisFavoritos_ok() throws Exception {
        ListaPublica favoritos = new ListaPublica();
        favoritos.setNombre("Mis Favoritos");
        when(listaService.resolveEmailFromRequestOrSecurity()).thenReturn("user@mail.com");
        when(listaService.ensureMisFavoritosForUser("user@mail.com")).thenReturn(favoritos);

        mvc.perform(post("/listas/mis-favoritos/init"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Mis Favoritos"));
    }
}