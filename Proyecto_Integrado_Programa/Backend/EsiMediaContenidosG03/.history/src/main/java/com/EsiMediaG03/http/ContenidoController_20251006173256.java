package com.EsiMediaG03.http;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("Contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {

    @Autowired
    private ContenidoService contenidoService;

    // Crear contenido usando JSON
    @PostMapping("/AñadirContend")
    public Contenido añadirContenido(@RequestBody Contenido contenido) throws Exception {
        return contenidoService.añadirContenido(contenido);
    }

    // Modificar contenido usando JSON
    @PutMapping("/contenidos")
    public Contenido modificarContenido(@RequestBody Contenido contenido) throws Exception {
        return contenidoService.modificarContenido(contenido);
    }

    // Eliminar contenido por ID
    @DeleteMapping("/contenidos/{id}")
    public void eliminarContenido(@PathVariable String id) {
        contenidoService.eliminarContenido(id);
    }

    // Listar todos los contenidos
    @GetMapping("/contenidos")
    public List<Contenido> listarContenidos() {
        return contenidoService.listarContenidos();
    }

    // Captura cualquier excepción y la devuelve al front
    @ExceptionHandler(Exception.class)
    public String handleException(Exception e) {
        return e.getMessage();
    }
}
