package com.EsiMediaG03.services;

import com.EsiMediaG03.dao.ListaPublicaDAO;
import com.EsiMediaG03.model.ListaPublica;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ListaPublicaService {

    private static final String LISTA_NO_ENCONTRADA = "Lista no encontrada con id ";

    private final ListaPublicaDAO listaPublicaDAO;

    public ListaPublicaService(ListaPublicaDAO listaPublicaDAO) {
        this.listaPublicaDAO = listaPublicaDAO;
    }

    public ListaPublica crearLista(ListaPublica lista) {
        return listaPublicaDAO.save(lista);
    }

    public List<ListaPublica> obtenerListasPublicas() {
        return listaPublicaDAO.findByPublicaTrue();
    }

    public List<ListaPublica> obtenerListasPorUsuario(String userEmail) {
        return listaPublicaDAO.findByUserEmail(userEmail);
    }

    public Optional<ListaPublica> obtenerListaPorId(String id) {
        return listaPublicaDAO.findById(id);
    }

    public void eliminarLista(String id) {
        listaPublicaDAO.deleteById(id);
    }

    public ListaPublica actualizarLista(String id, ListaPublica nuevaLista) {
        return listaPublicaDAO.findById(id)
                .map(lista -> {
                    lista.setNombre(nuevaLista.getNombre());
                    lista.setDescripcion(nuevaLista.getDescripcion());
                    lista.setContenidosIds(nuevaLista.getContenidosIds());
                    lista.setPublica(nuevaLista.isPublica());
                    return listaPublicaDAO.save(lista);
                })
                .orElseThrow(() -> new RuntimeException(LISTA_NO_ENCONTRADA + id));
    }
    
public ListaPublica anadirContenidoALista(String listaId, String contenidoId) {
        ListaPublica lista = listaPublicaDAO.findById(listaId)
            .orElseThrow(() -> new RuntimeException(LISTA_NO_ENCONTRADA + listaId));

        // ⚠️ Blindaje null-safe
        List<String> ids = lista.getContenidosIds();
        if (ids == null) {
            ids = new ArrayList<>();
            lista.setContenidosIds(ids);
        }

        if (!ids.contains(contenidoId)) {
            ids.add(contenidoId);
            listaPublicaDAO.save(lista);
        }
        return lista;
    }


    public ListaPublica eliminarContenidoDeLista(String listaId, String contenidoId) {
        ListaPublica lista = listaPublicaDAO.findById(listaId)
                .orElseThrow(() -> new RuntimeException(LISTA_NO_ENCONTRADA + listaId));

        lista.getContenidosIds().remove(contenidoId);
        listaPublicaDAO.save(lista);

        return lista;
    }
}
