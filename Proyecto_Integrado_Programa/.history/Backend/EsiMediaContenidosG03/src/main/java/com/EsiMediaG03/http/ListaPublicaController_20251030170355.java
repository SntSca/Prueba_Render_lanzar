package com.EsiMediaG03.http;

import com.EsiMediaG03.model.ListaPublica;
import com.EsiMediaG03.services.ListaPublicaService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/listas")
@CrossOrigin(origins = "http://localhost:4200")
public class ListaPublicaController {

    private final ListaPublicaService listaService;

    public ListaPublicaController(ListaPublicaService listaService) {
        this.listaService = listaService;
    }

    @PostMapping
    public ListaPublica crearLista(@RequestBody ListaPublica lista) {
        return listaService.crearLista(lista);
    }

    @GetMapping("/publicas")
    public List<ListaPublica> obtenerListasPublicas() {
        return listaService.obtenerListasPublicas();
    }

    @GetMapping("/usuario/{email}")
    public List<ListaPublica> obtenerListasPorUsuario(@PathVariable String email) {
        return listaService.obtenerListasPorUsuario(email);
    }

    @GetMapping("/{id}")
    public ListaPublica obtenerListaPorId(@PathVariable String id) {
        return listaService.obtenerListaPorId(id)
                .orElseThrow(() -> new RuntimeException("Lista no encontrada con id " + id));
    }

    @PutMapping("/{id}")
    public ListaPublica actualizarLista(@PathVariable String id, @RequestBody ListaPublica lista) {
        return listaService.actualizarLista(id, lista);
    }

    @DeleteMapping("/{id}")
    public void eliminarLista(@PathVariable String id) {
        listaService.eliminarLista(id);
    }
    @PostMapping("/{listaId}/contenidos/{contenidoId}")
    public ListaPublica anadirContenidoALista(@PathVariable String listaId, @PathVariable String contenidoId) {
        return listaService.anadirContenidoALista(listaId, contenidoId);
    }

    @DeleteMapping("/{listaId}/contenidos/{contenidoId}")
    public ListaPublica eliminarContenidoDeLista(@PathVariable String listaId, @PathVariable String contenidoId) {
        return listaService.eliminarContenidoDeLista(listaId, contenidoId);
    }
}
