package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ListaPublicaDAO;
import com.EsiMediaG03.model.ListaPublica;
import com.EsiMediaG03.services.ListaPublicaService;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ListaPublicaServiceTest {

    @Mock
    private ListaPublicaDAO listaPublicaDAO;

    @InjectMocks
    private ListaPublicaService service;

    @Test
    @DisplayName("crearLista -> delega en save")
    void crearLista() {
        ListaPublica in = new ListaPublica();
        ListaPublica out = new ListaPublica();
        when(listaPublicaDAO.save(in)).thenReturn(out);

        assertSame(out, service.crearLista(in));
        verify(listaPublicaDAO).save(in);
    }

    @Test
    @DisplayName("obtenerListasPublicas -> findByPublicaTrue")
    void obtenerListasPublicas() {
        when(listaPublicaDAO.findByPublicaTrue()).thenReturn(List.of(new ListaPublica(), new ListaPublica()));
        assertEquals(2, service.obtenerListasPublicas().size());
        verify(listaPublicaDAO).findByPublicaTrue();
    }

    @Test
    @DisplayName("obtenerListasPorUsuario -> findByUserEmail")
    void obtenerListasPorUsuario() {
        when(listaPublicaDAO.findByUserEmail("u@x.com")).thenReturn(List.of(new ListaPublica()));
        assertEquals(1, service.obtenerListasPorUsuario("u@x.com").size());
        verify(listaPublicaDAO).findByUserEmail("u@x.com");
    }

    @Test
    @DisplayName("obtenerListaPorId -> findById")
    void obtenerListaPorId() {
        ListaPublica l = new ListaPublica();
        when(listaPublicaDAO.findById("L1")).thenReturn(Optional.of(l));
        Optional<ListaPublica> res = service.obtenerListaPorId("L1");
        assertTrue(res.isPresent());
        assertSame(l, res.get());
        verify(listaPublicaDAO).findById("L1");
    }

    @Test
    @DisplayName("eliminarLista -> deleteById")
    void eliminarLista() {
        service.eliminarLista("L2");
        verify(listaPublicaDAO).deleteById("L2");
    }

    @Test
    @DisplayName("actualizarLista OK -> actualiza campos y guarda")
    void actualizarLista_ok() {
        ListaPublica original = new ListaPublica();
        original.setNombre("old");
        original.setDescripcion("desc");
        original.setContenidosIds(new ArrayList<>(List.of("c1")));
        original.setPublica(true);

        ListaPublica cambios = new ListaPublica();
        cambios.setNombre("new");
        cambios.setDescripcion("desc2");
        cambios.setContenidosIds(new ArrayList<>(List.of("c2","c3")));
        cambios.setPublica(false);

        when(listaPublicaDAO.findById("L3")).thenReturn(Optional.of(original));
        when(listaPublicaDAO.save(any(ListaPublica.class))).thenAnswer(i -> i.getArgument(0));

        ListaPublica res = service.actualizarLista("L3", cambios);
        assertEquals("new", res.getNombre());
        assertEquals("desc2", res.getDescripcion());
        assertEquals(List.of("c2","c3"), res.getContenidosIds());
        assertFalse(res.isPublica());
        verify(listaPublicaDAO).save(original);
    }

    @Test
    @DisplayName("actualizarLista Not Found -> lanza RuntimeException")
    void actualizarLista_notFound() {
        when(listaPublicaDAO.findById("NOPE")).thenReturn(Optional.empty());
        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> service.actualizarLista("NOPE", new ListaPublica()));
        assertTrue(ex.getMessage().contains("Lista no encontrada"));
        verify(listaPublicaDAO, never()).save(any());
    }

    @Test
    @DisplayName("anadirContenidoALista -> inicializa lista si null, no duplica y guarda")
    void anadirContenidoALista() {
        ListaPublica lista = new ListaPublica();
        lista.setContenidosIds(null);
        when(listaPublicaDAO.findById("L4")).thenReturn(Optional.of(lista));
        when(listaPublicaDAO.save(any(ListaPublica.class))).thenAnswer(i -> i.getArgument(0));

        ListaPublica r1 = service.anadirContenidoALista("L4", "c1");
        assertEquals(List.of("c1"), r1.getContenidosIds());

        ListaPublica r2 = service.anadirContenidoALista("L4", "c1"); // intento duplicado
        assertEquals(List.of("c1"), r2.getContenidosIds());

        verify(listaPublicaDAO, times(2)).save(lista);
    }

    @Test
    @DisplayName("eliminarContenidoDeLista -> elimina si existe y guarda")
    void eliminarContenidoDeLista() {
        ListaPublica lista = new ListaPublica();
        lista.setContenidosIds(new ArrayList<>(List.of("c1","c2")));
        when(listaPublicaDAO.findById("L5")).thenReturn(Optional.of(lista));
        when(listaPublicaDAO.save(any(ListaPublica.class))).thenAnswer(i -> i.getArgument(0));

        ListaPublica res = service.eliminarContenidoDeLista("L5", "c1");
        assertEquals(List.of("c2"), res.getContenidosIds());
        verify(listaPublicaDAO).save(lista);
    }
}
 
    
}
