package com.EsiMediaG03.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.model.Contenido;

@Service
public class ContenidoService {

    @Autowired
    private ContenidoDAO contenidoDAO;

    private static final String AUDIO_UPLOAD_DIR = "uploads/audios/";

    // Añadir contenido según tipo
    public Contenido añadirContenido(String titulo, String descripcion, MultipartFile ficheroAudio, String urlVideo,
                                     List<String> tags, int duracionMinutos, String resolucion, boolean vip, boolean visible,
                                     LocalDateTime disponibleHasta, boolean restringidoEdad, Contenido.Tipo tipo) throws Exception {

        if (tipo == Contenido.Tipo.AUDIO) {
            if (ficheroAudio == null || ficheroAudio.isEmpty()) {
                throw new IllegalArgumentException("Debe subir un fichero de audio.");
            }
            if (!esAudio(ficheroAudio)) {
                throw new IllegalArgumentException("El fichero subido no es un audio válido.");
            }
            return añadirAudio(titulo, descripcion, ficheroAudio, tags, duracionMinutos, vip, visible, disponibleHasta, restringidoEdad);

        } else if (tipo == Contenido.Tipo.VIDEO) {
            if (urlVideo == null || urlVideo.isBlank()) {
                throw new IllegalArgumentException("Debe especificar una URL de vídeo.");
            }
            return añadirVideo(titulo, descripcion, urlVideo, tags, duracionMinutos, resolucion, vip, visible, disponibleHasta, restringidoEdad);

        } else {
            throw new IllegalArgumentException("El tipo de contenido debe ser AUDIO o VIDEO.");
        }
    }

    // Validar cabecera de audio
    private boolean esAudio(MultipartFile file) throws IOException {
        String mimeType = Files.probeContentType(file.getResource().getFile().toPath());
        return mimeType != null && mimeType.startsWith("audio");
    }

    // Añadir audio
    private Contenido añadirAudio(String titulo, String descripcion, MultipartFile ficheroAudio, List<String> tags,
                                  int duracionMinutos, boolean vip, boolean visible, LocalDateTime disponibleHasta,
                                  boolean restringidoEdad) throws Exception {

        Path uploadPath = Paths.get(AUDIO_UPLOAD_DIR);
        if (!Files.exists(uploadPath)) Files.createDirectories(uploadPath);

        String filePath = AUDIO_UPLOAD_DIR + ficheroAudio.getOriginalFilename();
        Files.copy(ficheroAudio.getInputStream(), Paths.get(filePath));

        Contenido contenido = new Contenido();
        contenido.setTitulo(titulo);
        contenido.setDescripcion(descripcion);
        contenido.setFicheroAudio(filePath);
        contenido.setUrlVideo(null);
        contenido.setResolucion(null);
        contenido.setTags(tags);
        contenido.setDuracionMinutos(duracionMinutos);
        contenido.setVip(vip);
        contenido.setVisible(visible);
        contenido.setDisponibleHasta(disponibleHasta);
        contenido.setRestringidoEdad(restringidoEdad);
        contenido.setTipo(Contenido.Tipo.AUDIO);

        return contenidoDAO.save(contenido);
    }

    // Añadir vídeo
    private Contenido añadirVideo(String titulo, String descripcion, String urlVideo, List<String> tags,
                                  int duracionMinutos, String resolucion, boolean vip, boolean visible,
                                  LocalDateTime disponibleHasta, boolean restringidoEdad) {

        if (resolucion != null && !resolucion.matches("(?i)720|1080|4k")) {
            throw new IllegalArgumentException("Resolución de vídeo no válida (solo 720, 1080, 4k).");
        }

        Contenido contenido = new Contenido();
        contenido.setTitulo(titulo);
        contenido.setDescripcion(descripcion);
        contenido.setFicheroAudio(null);
        contenido.setUrlVideo(urlVideo);
        contenido.setResolucion(resolucion);
        contenido.setTags(tags);
        contenido.setDuracionMinutos(duracionMinutos);
        contenido.setVip(vip);
        contenido.setVisible(visible);
        contenido.setDisponibleHasta(disponibleHasta);
        contenido.setRestringidoEdad(restringidoEdad);
        contenido.setTipo(Contenido.Tipo.VIDEO);

        return contenidoDAO.save(contenido);
    }

    // Listar todos
    public List<Contenido> listarContenidos() {
        return contenidoDAO.findAll();
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

    // Modificar contenido
    public Contenido modificarContenido(Contenido contenido) {
        return contenidoDAO.save(contenido);
    }
}
