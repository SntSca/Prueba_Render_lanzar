package com.EsiMediaG03.http;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

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

    @PostMapping("/EliminarContenido")
    public ResponseEntity<Void> eliminarContenido(@RequestBody Map<String, String> request) {
        try {
            String id = request.get("id");
            contenidoService.eliminarContenido(id);
            return ResponseEntity.noContent().build(); // 204 No Content
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build(); // 404 Not Found
            }
        }
    }



    @GetMapping("/ListarContenidos")
        public ResponseEntity<List<Contenido>> listarContenidos() {
            return ResponseEntity.ok(contenidoService.listarContenidos());
        }
        
    @PostMapping("/ListarContenidos")
        public ResponseEntity<List<Contenido>> listarContenidos(@RequestBody(required = false) Map<String, Object> filtro) {
            return ResponseEntity.ok(contenidoService.listarContenidos());
        }

    // Buscar por título
    @PostMapping("/BuscarPorTitulo")
    public ResponseEntity<Contenido> buscarPorTitulo(@RequestBody Map<String, String> request) {
        String titulo = request.get("titulo");
        if (titulo == null || titulo.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return contenidoService.buscarPorTitulo(titulo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Listar contenidos visibles
    @PostMapping("/ListarVisibles")
    public ResponseEntity<List<Contenido>> listarVisibles(@RequestBody(required = false) Map<String, Object> filtro) {
        return ResponseEntity.ok(contenidoService.listarVisibles());
    }

    // Buscar por tags
    @PostMapping("/BuscarPorTags")
    public ResponseEntity<List<Contenido>> buscarPorTags(@RequestBody Map<String, List<String>> request) {
        List<String> tags = request.get("tags");
        if (tags == null || tags.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(contenidoService.buscarPorTags(tags));
    }

    // Buscar por tipo
    @PostMapping("/BuscarPorTipo")
    public ResponseEntity<List<Contenido>> buscarPorTipo(@RequestBody Map<String, String> request) {
        String tipoStr = request.get("tipo");
        if (tipoStr == null || tipoStr.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            Contenido.Tipo tipo = Contenido.Tipo.valueOf(tipoStr.toUpperCase());
            return ResponseEntity.ok(contenidoService.buscarPorTipo(tipo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
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
