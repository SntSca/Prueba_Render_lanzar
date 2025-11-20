package com.EsiMediaG03.http;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("Contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {

    @Autowired
    private ContenidoService contenidoService;

    // Crear contenido usando JSON
    @PostMapping("/AñadirContenido")
    public ResponseEntity<Contenido> añadirContenido(@RequestBody Contenido contenido) throws Exception {
        Contenido resultado = contenidoService.añadirContenido(contenido);
        return ResponseEntity.status(HttpStatus.CREATED).body(resultado); // 201 Created
    }

    // Modificar contenido usando JSON
    @PutMapping("/ModificarContenido")
    public ResponseEntity<Contenido> modificarContenido(@RequestBody Contenido contenido) throws Exception {
        Contenido resultado = contenidoService.modificarContenido(contenido);
        return ResponseEntity.ok(resultado); // 200 OK
    }

    // Eliminar contenido por ID
    @DeleteMapping("/EliminarContenido/{id}")
    public ResponseEntity<Void> eliminarContenido(@PathVariable String id) {
        contenidoService.eliminarContenido(id);
        return ResponseEntity.noContent().build();
    }

    // Listar todos los contenidos
    @GetMapping("/ListarContenidos")
    public ResponseEntity<List<Contenido>> listarContenidos() {
        return ResponseEntity.ok(contenidoService.listarContenidos());
    }

    // Manejo de excepciones
    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleException(Exception e) {
        if (e instanceof IllegalArgumentException) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(e.getMessage()); // 400 Bad Request
        }
        // Otros errores
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error interno: " + e.getMessage()); // 500 Internal Server Error
    }
}
