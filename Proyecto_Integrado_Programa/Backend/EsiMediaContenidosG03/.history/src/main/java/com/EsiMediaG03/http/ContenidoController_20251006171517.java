package com.EsiMediaG03.http;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {

    @Autowired
    private ContenidoService contenidoService;

    @PostMapping("/añadir")
    public ResponseEntity<?> añadirContenido(
            @RequestParam String titulo,
            @RequestParam String descripcion,
            @RequestParam(required = false) MultipartFile ficheroAudio,
            @RequestParam(required = false) String urlVideo,
            @RequestParam List<String> tags,
            @RequestParam int duracionMinutos,
            @RequestParam(required = false) String resolucion,
            @RequestParam boolean vip,
            @RequestParam boolean visible,
            @RequestParam(required = false) String disponibleHasta,
            @RequestParam boolean restringidoEdad,
            @RequestParam Contenido.Tipo tipo
    ) {
        try {
            LocalDateTime fechaDisponibleHasta = null;
            if (disponibleHasta != null && !disponibleHasta.isBlank()) {
                fechaDisponibleHasta = LocalDateTime.parse(disponibleHasta);
            }

            Contenido contenido = contenidoService.añadirContenido(
                    titulo, descripcion, ficheroAudio, urlVideo, tags,
                    duracionMinutos, resolucion, vip, visible,
                    fechaDisponibleHasta, restringidoEdad, tipo
            );
            return ResponseEntity.ok(contenido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @GetMapping("/listar")
    public ResponseEntity<List<Contenido>> listarContenidos() {
        return ResponseEntity.ok(contenidoService.listarContenidos());
    }

    @GetMapping("/buscar")
    public ResponseEntity<?> buscarPorTitulo(@RequestParam String titulo) {
        try {
            Contenido contenido = contenidoService.buscarPorTitulo(titulo);
            if (contenido == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Contenido no encontrado");
            }
            return ResponseEntity.ok(contenido);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @GetMapping("/visibles")
    public ResponseEntity<List<Contenido>> listarVisibles() {
        return ResponseEntity.ok(contenidoService.listarVisibles());
    }

    @GetMapping("/tags")
    public ResponseEntity<List<Contenido>> buscarPorTags(@RequestParam List<String> tags) {
        return ResponseEntity.ok(contenidoService.buscarPorTags(tags));
    }

    @GetMapping("/tipo")
    public ResponseEntity<List<Contenido>> buscarPorTipo(@RequestParam Contenido.Tipo tipo) {
        return ResponseEntity.ok(contenidoService.buscarPorTipo(tipo));
    }

    @DeleteMapping("/eliminar/{id}")
    public ResponseEntity<?> eliminarContenido(@PathVariable String id) {
        try {
            contenidoService.eliminarContenido(id);
            return ResponseEntity.ok("Contenido eliminado correctamente");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PutMapping("/modificar")
    public ResponseEntity<?> modificarContenido(@RequestBody Contenido contenido) {
        try {
            Contenido modificado = contenidoService.modificarContenido(contenido);
            return ResponseEntity.ok(modificado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }
}
