package com.EsiMediaG03.services;

import com.EsiMediaG03.dao.ListaPublicaDAO;
import com.EsiMediaG03.model.ListaPublica;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ListaPublicaService {

    @Autowired
    private ListaPublicaDAO listaPublicaDAO;

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
                .orElseThrow(() -> new RuntimeException("Lista no encontrada con id " + id));
    }
}
