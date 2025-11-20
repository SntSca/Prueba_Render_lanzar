package com.EsiMediaG03.services;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;

import org.springframework.data.mongodb.core.MongoTemplate;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.exceptions.ContenidoException;
import com.EsiMediaG03.model.Contenido;

@Service
public class ContenidoService {

    private final ContenidoDAO contenidoDAO;
    private final MongoTemplate mongoTemplate;

    public ContenidoService(ContenidoDAO contenidoDAO, MongoTemplate mongoTemplate) {
        this.contenidoDAO = contenidoDAO;
        this.mongoTemplate = mongoTemplate;
    }

    // ============================
    // CRUD BÁSICO
    // ============================

    public Contenido anadirContenido(Contenido contenido) throws Throwable {
        validarcontenido(contenido);
        return contenidoDAO.save(contenido);
    }

    public java.util.List<Contenido> listarContenidos() {
        return contenidoDAO.findAll();
    }

    // ============================
    // MODIFICAR / ELIMINAR
    // ============================

    public Contenido modificarContenido(String id,
                                        ModificarContenidoRequest cambios,
                                        String requesterEmail,
                                        String requesterRole,
                                        Contenido.Tipo requesterTipo) throws Throwable {
        Contenido actual = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contenido no encontrado: " + id));

        checkPermisosPorTipo(actual, requesterTipo, "modificar");

        if (notBlank(cambios.titulo)) actual.setTitulo(cambios.titulo);
        if (notBlank(cambios.descripcion)) actual.setDescripcion(cambios.descripcion);
        if (cambios.tags != null && !cambios.tags.isEmpty()) actual.setTags(cambios.tags);
        if (cambios.duracionMinutos != null) actual.setDuracionMinutos(cambios.duracionMinutos);
        if (notBlank(cambios.resolucion)) actual.setResolucion(cambios.resolucion);
        if (cambios.vip != null) actual.setVip(cambios.vip);
        if (cambios.visible != null) actual.setVisible(cambios.visible);
        if (cambios.disponibleHasta != null) actual.setDisponibleHasta(cambios.disponibleHasta);
        if (cambios.restringidoEdad != null) actual.setRestringidoEdad(cambios.restringidoEdad);
        if (notBlank(cambios.imagen)) actual.setImagen(cambios.imagen);

        if (actual.getTipo() == Contenido.Tipo.AUDIO) {
            if (notBlank(cambios.ficheroAudio)) actual.setFicheroAudio(cambios.ficheroAudio);
            if (notBlank(cambios.urlVideo) || notBlank(cambios.resolucion)) {
                throw new ContenidoException("No puedes establecer campos de VIDEO en un contenido AUDIO.");
            }
        } else if (actual.getTipo() == Contenido.Tipo.VIDEO) {
            if (notBlank(cambios.urlVideo)) actual.setUrlVideo(cambios.urlVideo);
            if (notBlank(cambios.resolucion)) actual.setResolucion(cambios.resolucion);
            if (notBlank(cambios.ficheroAudio)) {
                throw new ContenidoException("No puedes establecer campos de AUDIO en un contenido VIDEO.");
            }
        }

        validarcontenido(actual);
        return contenidoDAO.save(actual);
    }

    public void eliminarContenido(String id,
                                  String requesterEmail,
                                  String requesterRole,
                                  Contenido.Tipo requesterTipo) {
        Contenido actual = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contenido no encontrado: " + id));

        checkPermisosPorTipo(actual, requesterTipo, "eliminar");

        contenidoDAO.deleteById(id);
    }

    public StreamingTarget resolveStreamingTarget(String id, Boolean isVip, Integer ageYears) throws Exception {
        Contenido c = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contenido no encontrado: " + id));

        validarAccesoAContenido(c, isVip, ageYears, LocalDateTime.now());

        if (c.getTipo() == null) throw new IllegalArgumentException("Tipo de contenido no definido.");

        switch (c.getTipo()) {
            case AUDIO -> {
                String pathStr = c.getFicheroAudio();
                if (pathStr == null || pathStr.isBlank()) {
                    throw new IllegalArgumentException("AUDIO sin ficheroAudio.");
                }
                Path path = Path.of(pathStr);
                if (!Files.exists(path) || !Files.isReadable(path)) {
                    throw new IllegalStateException("Fichero de audio no accesible: " + path);
                }
                long length = Files.size(path);
                String mime = guessMimeFromExt(pathStr, "audio/mpeg");
                return StreamingTarget.local(path, length, mime);
            }
            case VIDEO -> {
                String urlOrPath = c.getUrlVideo();
                if (urlOrPath == null || urlOrPath.isBlank()) {
                    throw new IllegalArgumentException("VIDEO sin urlVideo o ruta local.");
                }
                if (isHttp(urlOrPath)) {
                    return StreamingTarget.external(urlOrPath, "video/mp4");
                } else {
                    Path path = Path.of(urlOrPath);
                    if (!Files.exists(path) || !Files.isReadable(path)) {
                        throw new IllegalStateException("Fichero de vídeo no accesible: " + path);
                    }
                    long length = Files.size(path);
                    String mime = guessMimeFromExt(urlOrPath, "video/mp4");
                    return StreamingTarget.local(path, length, mime);
                }
            }
            default -> throw new IllegalArgumentException("Tipo no soportado.");
        }
    }

    private void validarAccesoAContenido(Contenido c, Boolean isVip, Integer ageYears, LocalDateTime now) {
        if (!c.isVisible()) {
            throw new ContenidoException("Este contenido no está disponible en este momento.");
        }
        if (c.getDisponibleHasta() != null && !c.getDisponibleHasta().isAfter(now)) {
            throw new ContenidoException("Este contenido ha dejado de estar disponible.");
        }
        if (c.isVip() && !Boolean.TRUE.equals(isVip)) {
            throw new ContenidoException("Contenido VIP — necesitas una suscripción VIP para reproducirlo.");
        }
        int minAge = c.getRestringidoEdad();
        if (minAge > 0) {
            if (ageYears == null) {
                throw new ContenidoException("Contenido restringido — no se pudo verificar tu edad.");
            }
            if (ageYears < minAge) {
                throw new ContenidoException("Contenido restringido a mayores de " + minAge + " años.");
            }
        }
    }

    public static Integer calcularEdad(LocalDate birthdate) {
        if (birthdate == null) return null;
        return Period.between(birthdate, LocalDate.now()).getYears();
    }

    private boolean isHttp(String s) {
        String l = s.toLowerCase();
        return l.startsWith("http://") || l.startsWith("https://");
    }

    private String guessMimeFromExt(String path, String fallback) {
        String l = path.toLowerCase();
        if (l.endsWith(".mp3")) return "audio/mpeg";
        if (l.endsWith(".wav")) return "audio/wav";
        if (l.endsWith(".m4a")) return "audio/mp4";
        if (l.endsWith(".flac")) return "audio/flac";
        if (l.endsWith(".mp4")) return "video/mp4";
        if (l.endsWith(".webm")) return "video/webm";
        if (l.endsWith(".mkv")) return "video/x-matroska";
        return fallback;
    }

    public void registrarReproduccionSiUsuario(String contenidoId, String userRole) {
        if (userRole == null || !userRole.equalsIgnoreCase("USUARIO")) return;
        Query q = new Query(where("_id").is(contenidoId));
        Update u = new Update().inc("reproducciones", 1L);
        mongoTemplate.updateFirst(q, u, Contenido.class);
    }

    private void validarcontenido(Contenido contenido) throws Throwable {
        validarTipoContenido(contenido);
        validarTituloYTags(contenido);
        validarDuracion(contenido);
    }

    private void validarTipoContenido(Contenido contenido) {
        if (contenido.getTipo() == null) {
            throw new IllegalArgumentException("El tipo de contenido debe ser AUDIO o VIDEO.");
        }

        if (contenido.getTipo() == Contenido.Tipo.AUDIO) {
            validarFicheroAudio(contenido);
        } else if (contenido.getTipo() == Contenido.Tipo.VIDEO) {
            validarVideo(contenido);
        }
    }

    private void validarFicheroAudio(Contenido contenido) {
        if (contenido.getFicheroAudio() == null || contenido.getFicheroAudio().isBlank()) {
            throw new IllegalArgumentException("Debe indicar la ruta del fichero de audio.");
        }
    }

    private void validarVideo(Contenido contenido) {
        if (contenido.getUrlVideo() == null || contenido.getUrlVideo().isBlank()) {
            throw new IllegalArgumentException("Debe especificar una URL de vídeo.");
        }
        if (contenido.getResolucion() != null && !contenido.getResolucion().matches("(?i)^(720p|1080p|4k)$")) {
            throw new IllegalArgumentException("Resolución de vídeo no válida (solo 720p, 1080p, 4K).");
        }
    }

    private void validarTituloYTags(Contenido contenido) {
        if (contenido.getTitulo() == null || contenido.getTitulo().isBlank()) {
            throw new IllegalArgumentException("El título es obligatorio.");
        }
        if (contenido.getTags() == null || contenido.getTags().isEmpty()) {
            throw new IllegalArgumentException("Debe indicar al menos un tag.");
        }
    }

    private void validarDuracion(Contenido contenido) {
        if (contenido.getDuracionMinutos() <= 0) {
            throw new IllegalArgumentException("La duración debe ser mayor a 0 minutos.");
        }
    }

    private void checkPermisosPorTipo(Contenido c,
                                      Contenido.Tipo requesterTipo,
                                      String accionVerbo) {
        if (requesterTipo == null) {
            throw new ContenidoException("Debes indicar tu tipo de creador (AUDIO/VIDEO).");
        }
        if (c.getTipo() != requesterTipo) {
            if (c.getTipo() == Contenido.Tipo.AUDIO && requesterTipo == Contenido.Tipo.VIDEO) {
                throw new ContenidoException("Un creador de VIDEO no puede " + accionVerbo + " contenido de AUDIO.");
            }
            if (c.getTipo() == Contenido.Tipo.VIDEO && requesterTipo == Contenido.Tipo.AUDIO) {
                throw new ContenidoException("Un creador de AUDIO no puede " + accionVerbo + " contenido de VIDEO.");
            }
            throw new ContenidoException("No puedes " + accionVerbo + " contenido de tipo " + c.getTipo()
                    + " siendo creador de tipo " + requesterTipo + ".");
        }
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
