package com.EsiMediaG03.http;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("Contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {

    @Autowired
    private ContenidoService contenidoService;

    @PostMapping("/contenidos")
    public Contenido añadirContenido(@RequestParam String titulo,
                                     @RequestParam String descripcion,
                                     @RequestParam(required = false) MultipartFile ficheroAudio,
                                     @RequestParam(required = false) String urlVideo,
                                     @RequestParam List<String> tags,
                                     @RequestParam int duracionMinutos,
                                     @RequestParam(required = false) String resolucion,
                                     @RequestParam boolean vip,
                                     @RequestParam boolean visible,
                                     @RequestParam(required = false) LocalDateTime disponibleHasta,
                                     @RequestParam boolean restringidoEdad,
                                     @RequestParam Contenido.Tipo tipo) throws Exception {

        return contenidoService.añadirContenido(titulo, descripcion, ficheroAudio, urlVideo, tags,
                                                duracionMinutos, resolucion, vip, visible, disponibleHasta,
                                                restringidoEdad, tipo);
    }

    @PutMapping("/contenidos")
    public Contenido modificarContenido(@RequestParam Contenido contenido) {
        return contenidoService.modificarContenido(contenido);
    }

    @DeleteMapping("/contenidos/{id}")
    public void eliminarContenido(@PathVariable String id) {
        contenidoService.eliminarContenido(id);
    }

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
