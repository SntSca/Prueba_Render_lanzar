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
import com.EsiMediaG03.exceptions.ContenidoValidationException;
import com.EsiMediaG03.model.Contenido;

@Service
public class ContenidoService {

    private final ContenidoDAO contenidoDAO;
    private final MongoTemplate mongoTemplate;
    private static final String VIDEO_MP4 = "video/mp4";
    private static final String CONTENIDO_NO_ENCONTRADO = "Contenido no encontrado: ";

    public ContenidoService(ContenidoDAO contenidoDAO, MongoTemplate mongoTemplate) {
        this.contenidoDAO = contenidoDAO;
        this.mongoTemplate = mongoTemplate;
    }


    public Contenido anadirContenido(Contenido contenido) throws Throwable {
        validarcontenido(contenido);
        return contenidoDAO.save(contenido);
    }

    public java.util.List<Contenido> listarContenidos() {
        return contenidoDAO.findAll();
    }

    public Contenido modificarContenido(String id,
                                        ModificarContenidoRequest cambios,
                                        Contenido.Tipo requesterTipo) throws Throwable {
        Contenido actual = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(CONTENIDO_NO_ENCONTRADO + id));

        checkPermisosPorTipo(actual, requesterTipo, "modificar");

        applyCommonPatch(actual, cambios);
        opsFor(actual.getTipo()).patch(actual, cambios);

        validarcontenido(actual);
        return contenidoDAO.save(actual);
    }

    public void eliminarContenido(String id, Contenido.Tipo requesterTipo) {
        Contenido actual = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(CONTENIDO_NO_ENCONTRADO + id));

        checkPermisosPorTipo(actual, requesterTipo, "eliminar");
        contenidoDAO.deleteById(id);
    }

    private void applyCommonPatch(Contenido actual, ModificarContenidoRequest c) {
        setIfText(actual::setTitulo, c.titulo);
        setIfText(actual::setDescripcion, c.descripcion);
        if (c.tags != null && !c.tags.isEmpty()) actual.setTags(c.tags);
        if (c.duracionMinutos != null) actual.setDuracionMinutos(c.duracionMinutos);
        if (c.vip != null) actual.setVip(c.vip);
        if (c.visible != null) actual.setVisible(c.visible);
        if (c.disponibleHasta != null) actual.setDisponibleHasta(c.disponibleHasta);
        if (c.restringidoEdad != null) actual.setRestringidoEdad(c.restringidoEdad);
        setIfText(actual::setImagen, c.imagen);
    }

    public StreamingTarget resolveStreamingTarget(String id, Boolean isVip, Integer ageYears) throws Exception {
        Contenido c = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(CONTENIDO_NO_ENCONTRADO + id));

        validarAccesoAContenido(c, isVip, ageYears, LocalDateTime.now());
        return opsFor(c.getTipo()).buildTarget(c);
    }

    private interface TipoOps {
        void patch(Contenido actual, ModificarContenidoRequest c);
        StreamingTarget buildTarget(Contenido c) throws Exception;
    }

    private final TipoOps audioOps = new TipoOps() {
        @Override public void patch(Contenido actual, ModificarContenidoRequest c) {
            setIfText(actual::setFicheroAudio, c.ficheroAudio);
            assertBlank(c.urlVideo, "No puedes establecer campos de VIDEO en un contenido AUDIO.");
            assertBlank(nonBlankOrNull(c.resolucion), "No puedes establecer campos de VIDEO en un contenido AUDIO.");
        }
        @Override public StreamingTarget buildTarget(Contenido c) throws Exception {
            String pathStr = c.getFicheroAudio();
            if (isBlank(pathStr)) throw new IllegalArgumentException("AUDIO sin ficheroAudio.");
            Path path = Path.of(pathStr);
            ensureReadableFile(path, "Fichero de audio no accesible");
            long length = Files.size(path);
            String mime = guessMimeFromExt(pathStr, "audio/mpeg");
            return StreamingTarget.local(path, length, mime);
        }
    };

    private final TipoOps videoOps = new TipoOps() {
        @Override public void patch(Contenido actual, ModificarContenidoRequest c) {
            setIfText(actual::setUrlVideo, c.urlVideo);
            setIfText(actual::setResolucion, c.resolucion);
            assertBlank(c.ficheroAudio, "No puedes establecer campos de AUDIO en un contenido VIDEO.");
        }
        @Override public StreamingTarget buildTarget(Contenido c) throws Exception {
            String urlOrPath = c.getUrlVideo();
            if (isBlank(urlOrPath)) throw new IllegalArgumentException("VIDEO sin urlVideo o ruta local.");
            if (isHttp(urlOrPath)) {
                return StreamingTarget.external(urlOrPath, VIDEO_MP4);
            }
            Path path = Path.of(urlOrPath);
            ensureReadableFile(path, "Fichero de vídeo no accesible");
            long length = Files.size(path);
            String mime = guessMimeFromExt(urlOrPath, VIDEO_MP4);
            return StreamingTarget.local(path, length, mime);
        }

        private boolean isHttp(String s) {
            String l = s.toLowerCase();
            return l.startsWith("http://") || l.startsWith("https://");
        }
    };

    private TipoOps opsFor(Contenido.Tipo t) {
        if (t == null) throw new IllegalArgumentException("Tipo de contenido no definido.");
        return (t == Contenido.Tipo.AUDIO) ? audioOps : videoOps;
    }

    private void ensureReadableFile(Path path, String msgPrefix) {
        if (!Files.exists(path) || !Files.isReadable(path)) {
            throw new IllegalStateException(msgPrefix + ": " + path);
        }
    }

    private void setIfText(java.util.function.Consumer<String> setter, String value) {
        if (value != null && !value.isBlank()) setter.accept(value);
    }

    private void assertBlank(String value, String message) {
        if (value != null && !value.isBlank()) throw new ContenidoException(message);
    }
    // Removed from here and moved into the videoOps anonymous class

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
        if (l.endsWith(".mp4")) return VIDEO_MP4;
        if (l.endsWith(".webm")) return "video/webm";
        if (l.endsWith(".mkv")) return "video/x-matroska";
        return fallback;
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

    public void registrarReproduccionSiUsuario(String contenidoId, String userRole) {
        if (userRole == null || !userRole.equalsIgnoreCase("USUARIO")) return;
        Query q = new Query(where("_id").is(contenidoId));
        Update u = new Update().inc("reproducciones", 1L);
        mongoTemplate.updateFirst(q, u, Contenido.class);
    }

    private void validarcontenido(Contenido contenido) throws ContenidoValidationException {
        validarTipoContenido(contenido);
        validarTituloYTags(contenido);
        validarDuracion(contenido);
    }

    private void validarTipoContenido(Contenido contenido) {
        if (contenido.getTipo() == null) {
            throw new ContenidoValidationException("El tipo de contenido debe ser AUDIO o VIDEO.");
        }
        if (contenido.getTipo() == Contenido.Tipo.AUDIO) {
            validarFicheroAudio(contenido);
        } else if (contenido.getTipo() == Contenido.Tipo.VIDEO) {
            validarVideo(contenido);
        }
    }

    private void validarFicheroAudio(Contenido contenido) {
        if (contenido.getFicheroAudio() == null || contenido.getFicheroAudio().isBlank()) {
            throw new ContenidoValidationException("Debe indicar la ruta del fichero de audio.");
        }
    }

    private void validarVideo(Contenido contenido) {
        if (contenido.getUrlVideo() == null || contenido.getUrlVideo().isBlank()) {
            throw new ContenidoValidationException("Debe especificar una URL de vídeo.");
        }
        if (contenido.getResolucion() != null && !contenido.getResolucion().matches("(?i)^(720p|1080p|4k)$")) {
            throw new ContenidoValidationException("Resolución de vídeo no válida (solo 720p, 1080p, 4K).");
        }
    }

    private void validarTituloYTags(Contenido contenido) {
        if (contenido.getTitulo() == null || contenido.getTitulo().isBlank()) {
            throw new ContenidoValidationException("El título es obligatorio.");
        }
        if (contenido.getTags() == null || contenido.getTags().isEmpty()) {
            throw new ContenidoValidationException("Debe indicar al menos un tag.");
        }
    }

    private void validarDuracion(Contenido contenido) {
        if (contenido.getDuracionMinutos() <= 0) {
            throw new ContenidoValidationException("La duración debe ser mayor a 0 minutos.");
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
}
