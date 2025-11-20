package com.EsiMediaG03.http;


import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("Contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {
 
    private final ContenidoService contenidoService;

    public ContenidoController(ContenidoService contenidoService) {
        this.contenidoService = contenidoService;
    }

    @PostMapping("/AnadirContenido")
    public ResponseEntity<Contenido> anadirContenido(@RequestBody Contenido contenido) throws Throwable {
        Contenido resultado = contenidoService.anadirContenido(contenido);
        return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
    }

}
