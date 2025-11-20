package com.EsiMediaG03.services;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.model.Contenido;

@Service
public class ContenidoService {

    @Autowired
    private ContenidoDAO contenidoDAO;

    // Añadir contenido usando JSON
    public Contenido añadirContenido(Contenido contenido) throws Exception {
        validarContenido(contenido);
        return contenidoDAO.save(contenido);
    }

    // Modificar contenido usando JSON
    public Contenido modificarContenido(Contenido contenido) throws Exception {
        if (contenido.getId() == null || contenido.getId().isBlank()) {
            throw new IllegalArgumentException("El ID del contenido es obligatorio para modificar.");
        }
        validarContenido(contenido);
        return contenidoDAO.save(contenido);
    }

    // Validaciones básicas
    private void validarContenido(Contenido contenido) throws Exception {
        if (contenido.getTipo() == null) {
            throw new IllegalArgumentException("El tipo de contenido debe ser AUDIO o VIDEO.");
        }

        if (contenido.getTipo() == Contenido.Tipo.AUDIO) {
            if (contenido.getFicheroAudio() == null || contenido.getFicheroAudio().isBlank()) {
                throw new IllegalArgumentException("Debe indicar la ruta del fichero de audio.");
            }
        } else if (contenido.getTipo() == Contenido.Tipo.VIDEO) {
            if (contenido.getUrlVideo() == null || contenido.getUrlVideo().isBlank()) {
                throw new IllegalArgumentException("Debe especificar una URL de vídeo.");
            }
            if (contenido.getResolucion() != null && !contenido.getResolucion().matches("(?i)720|1080|4k")) {
                throw new IllegalArgumentException("Resolución de vídeo no válida (solo 720, 1080, 4k).");
            }
        }

        if (contenido.getTitulo() == null || contenido.getTitulo().isBlank()) {
            throw new IllegalArgumentException("El título es obligatorio.");
        }

        if (contenido.getTags() == null || contenido.getTags().isEmpty()) {
            throw new IllegalArgumentException("Debe indicar al menos un tag.");
        }

        if (contenido.getDuracionMinutos() <= 0) {
            throw new IllegalArgumentException("La duración debe ser mayor a 0 minutos.");
        }

        // Si no se indica disponibleHasta, se puede poner un valor por defecto (opcional)
        if (contenido.getDisponibleHasta() == null) {
            contenido.setDisponibleHasta(LocalDateTime.now().plusYears(1));
        }
    }

@GetMapping("/ListarContenidos")
    public ResponseEntity<List<Contenido>> listarContenidos() {
        return ResponseEntity.ok(contenidoService.listarContenidos());
    }

    // Buscar por título
    public Contenido buscarPorTitulo(String titulo) {
        return contenidoDAO.findByTitulo(titulo);
    }

    // Listar visibles
    public List<Contenido> listarVisibles() {
        return contenidoDAO.findByVisibleTrue();
    }

    // Buscar por tags
    public List<Contenido> buscarPorTags(List<String> tags) {
        return contenidoDAO.findByTagsIn(tags);
    }

    // Buscar por tipo
    public List<Contenido> buscarPorTipo(Contenido.Tipo tipo) {
        return contenidoDAO.findByTipo(tipo);
    }

    // Eliminar contenido
    public void eliminarContenido(String id) {
        contenidoDAO.deleteById(id);
    }
}
