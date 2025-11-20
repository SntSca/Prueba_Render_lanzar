package com.EsiMediaG03.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.mongodb.core.MongoTemplate;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.exceptions.ContenidoAddException;
import com.EsiMediaG03.exceptions.ContenidoException;
import com.EsiMediaG03.exceptions.ContenidoModificationException;
import com.EsiMediaG03.exceptions.ContenidoValidationException;
import com.EsiMediaG03.exceptions.StreamingTargetException;
import com.EsiMediaG03.exceptions.StreamingTargetResolutionException;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.model.ListaPublica;
import com.EsiMediaG03.dao.ListaPublicaDAO;
@Service
public class ContenidoService {

    private final ContenidoDAO contenidoDAO;
    private final MongoTemplate mongoTemplate;
    private final ListaPublicaDAO listaPublicaDAO;
    private static final String VIDEO_MP4 = "video/mp4";
    private static final String CONTENIDO_NO_ENCONTRADO = "Contenido no encontrado: ";
    private static final String USUARIO_NO_AUTENTICADO = "Usuario no autenticado";
    public static final String FAVORITOS_DE_USUARIOS = "favoritosDeUsuarios";
    private static final String ROLE_USUARIO = "USUARIO";

    public ContenidoService(ContenidoDAO contenidoDAO, MongoTemplate mongoTemplate, ListaPublicaDAO listaPublicaDAO) {
        this.contenidoDAO = contenidoDAO;
        this.mongoTemplate = mongoTemplate;
        this.listaPublicaDAO = listaPublicaDAO;
    }


    public Contenido anadirContenido(Contenido contenido) throws ContenidoAddException {
        try {
            validarcontenido(contenido);
        } catch (Exception e) {
            throw new ContenidoAddException("Error al añadir contenido: " + e.getMessage());
        }
        return contenidoDAO.save(contenido);
    }

    public java.util.List<Contenido> listarContenidos() {
        return contenidoDAO.findAll();
    }

    public Contenido modificarContenido(String id,
                                        ModificarContenidoRequest cambios,
                                        Contenido.Tipo requesterTipo) throws ContenidoModificationException {
        Contenido actual = contenidoDAO.findById(id)
                .orElseThrow(() -> new ContenidoModificationException(CONTENIDO_NO_ENCONTRADO + " " + id));

        checkPermisosPorTipo(actual, requesterTipo, "modificar");

        applyCommonPatch(actual, cambios);
        opsFor(actual.getTipo()).patch(actual, cambios);

        validarcontenido(actual);
        return contenidoDAO.save(actual);
    }

    public void eliminarContenido(String id, Contenido.Tipo requesterTipo) {
        Contenido actual = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(CONTENIDO_NO_ENCONTRADO + " " + id));

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
        if (actual.getDisponibleHasta() != null && actual.getDisponibleHasta().isBefore(LocalDateTime.now())) {
        actual.setVisible(false);
    }
    }

    public StreamingTarget resolveStreamingTarget(String id, Boolean isVip, Integer ageYears) throws StreamingTargetResolutionException, StreamingTargetException {
        Contenido c = contenidoDAO.findById(id)
                .orElseThrow(() -> new StreamingTargetResolutionException(CONTENIDO_NO_ENCONTRADO + " " + id));

        validarAccesoAContenido(c, isVip, ageYears, LocalDateTime.now());
        return opsFor(c.getTipo()).buildTarget(c);
    }

    private interface TipoOps {
        void patch(Contenido actual, ModificarContenidoRequest c);
        StreamingTarget buildTarget(Contenido c) throws StreamingTargetException;
    }

    private final TipoOps audioOps = new TipoOps() {
        @Override public void patch(Contenido actual, ModificarContenidoRequest c) {
            setIfText(actual::setFicheroAudio, c.ficheroAudio);
            assertBlank(c.urlVideo, "No puedes establecer campos de VIDEO en un contenido AUDIO.");
            assertBlank((c.resolucion != null && !c.resolucion.isBlank()) ? c.resolucion : null, "No puedes establecer campos de VIDEO en un contenido AUDIO.");
        }
        @Override public StreamingTarget buildTarget(Contenido c) throws StreamingTargetException {
            String pathStr = c.getFicheroAudio();
            if (isBlank(pathStr)) throw new StreamingTargetException("AUDIO sin ficheroAudio.");
            Path path = Path.of(pathStr);
            ensureReadableFile(path, "Fichero de audio no accesible");
            long length;
            try {
                length = Files.size(path);
            } catch (IOException e) {
                throw new StreamingTargetException("Error al obtener el tamaño del archivo: " + e.getMessage());
            }
            String mime = guessMimeFromExt(pathStr, "audio/mpeg");
            return StreamingTarget.local(path, length, mime);
        }
    };

    private final TipoOps videoOps = new TipoOps() {
        private boolean isHttp(String s) {
            String l = s.toLowerCase();
            return l.startsWith("http://") || l.startsWith("https://");
        }
        @Override public void patch(Contenido actual, ModificarContenidoRequest c) {
            setIfText(actual::setUrlVideo, c.urlVideo);
            setIfText(actual::setResolucion, c.resolucion);
            assertBlank(c.ficheroAudio, "No puedes establecer campos de AUDIO en un contenido VIDEO.");
        }
        @Override public StreamingTarget buildTarget(Contenido c) throws StreamingTargetException {
            String urlOrPath = c.getUrlVideo();
            if (isBlank(urlOrPath)) throw new IllegalArgumentException("VIDEO sin urlVideo o ruta local.");
            if (isHttp(urlOrPath)) {
                return StreamingTarget.external(urlOrPath, VIDEO_MP4);
            }
            Path path = Path.of(urlOrPath);
            ensureReadableFile(path, "Fichero de vídeo no accesible");
            long length;
            try {
                length = Files.size(path);
            } catch (IOException e) {
                throw new StreamingTargetException("Error al obtener el tamaño del archivo: " + e.getMessage());
            }
            String mime = guessMimeFromExt(urlOrPath, VIDEO_MP4);
            return StreamingTarget.local(path, length, mime);
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


    private boolean isBlank(String s) { return s == null || s.isBlank(); }



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
        if (userRole == null || !userRole.equalsIgnoreCase(ROLE_USUARIO)) return;
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

    public void registrarReproductor(String contenidoId, String userEmail) {
        if (userEmail == null || userEmail.isBlank()) return;
        var q = new org.springframework.data.mongodb.core.query.Query(
                org.springframework.data.mongodb.core.query.Criteria.where("_id").is(contenidoId));
        var u = new org.springframework.data.mongodb.core.query.Update()
                .addToSet("reproductores", userEmail);
        mongoTemplate.updateFirst(q, u, Contenido.class);
    }

    private String mapKeyForEmail(String email) {
        if (email == null) return null;
        return email.toLowerCase()
                    .replace(".", "%2E")
                    .replace("$", "%24");
    }

    public Map<String,Object> rateContenido(String id, String userEmail, double score) {
        if (userEmail == null || userEmail.isBlank())
            throw new ContenidoException("Debes iniciar sesión para valorar.");


        if (score < 0.5 || score > 5.0)
            throw new ContenidoValidationException("La puntuación debe estar entre 1.0 y 5.0.");
        double twoX = score * 2.0;
        if (Math.abs(twoX - Math.rint(twoX)) > 1e-9) 
            throw new ContenidoValidationException("La puntuación debe ser entera o media estrella (incrementos de 0.5).");

        Contenido c = contenidoDAO.findById(id)
            .orElseThrow(() -> new ContenidoException(CONTENIDO_NO_ENCONTRADO + " " + id));

        Set<String> repr = c.getReproductores();
        if (repr == null || !repr.contains(userEmail)) {
            throw new ContenidoException("Solo puedes valorar tras reproducir el contenido.");
        }

        Map<String, Double> ratings = c.getRatings();
        if (ratings == null) {
            ratings = new HashMap<>();
            c.setRatings(ratings);
        }

        String key = mapKeyForEmail(userEmail);

        
        if (ratings.containsKey(key)) {
            throw new ContenidoException("Ya has valorado este contenido. La primera valoración es definitiva.");
        }


        double total = c.getRatingAvg() * c.getRatingCount();
        total += score;
        c.setRatingCount(c.getRatingCount() + 1);
        c.setRatingAvg(total / c.getRatingCount());
        ratings.put(key, score);

        contenidoDAO.save(c);

        Map<String,Object> res = new HashMap<>();
        res.put("avg", c.getRatingAvg());
        res.put("count", c.getRatingCount());
        return res;
    }

    public Map<String,Object> ratingResumen(String id) {
        Contenido c = contenidoDAO.findById(id)
                .orElseThrow(() -> new ContenidoException(CONTENIDO_NO_ENCONTRADO+" " + id));
        Map<String,Object> res = new HashMap<>();
        res.put("avg", c.getRatingAvg());
        res.put("count", c.getRatingCount());
        return res;
    }




    public void addFavorito(String contenidoId, String userEmail, String roleHeader) {
        String email = (userEmail != null && !userEmail.isBlank()) ? userEmail : currentUserEmailOrNull();
        if (email == null) throw new AccessDeniedException(USUARIO_NO_AUTENTICADO);

        ensureUserRoleCanFavorite(roleHeader); 

        if (!canFavorite(contenidoId)) {
            throw new AccessDeniedException("No se permite marcar como favorito");
        }

        Query q = Query.query(Criteria.where("_id").is(contenidoId));
        Update u = new Update().addToSet(FAVORITOS_DE_USUARIOS, email);
        mongoTemplate.updateFirst(q, u, Contenido.class);
    }

    public void removeFavorito(String contenidoId, String userEmail) {
        String email = (userEmail != null && !userEmail.isBlank()) ? userEmail : currentUserEmailOrNull();
        if (email == null) throw new AccessDeniedException(USUARIO_NO_AUTENTICADO);

        Query q = Query.query(Criteria.where("_id").is(contenidoId));
        Update u = new Update().pull(FAVORITOS_DE_USUARIOS, email);
        mongoTemplate.updateFirst(q, u, Contenido.class);
    }

    public List<String> listFavoritosIds(String userEmail) {
        String email = (userEmail != null && !userEmail.isBlank()) ? userEmail : currentUserEmailOrNull();
        if (email == null) throw new AccessDeniedException(USUARIO_NO_AUTENTICADO);

        Query q = Query.query(Criteria.where(FAVORITOS_DE_USUARIOS).is(email))
                    .with(Sort.by(Sort.Direction.DESC, "fechaEstado"));
        return mongoTemplate.find(q, Contenido.class)
                .stream().map(Contenido::getId).toList();
    }

    
    private String currentUserEmailOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth instanceof AnonymousAuthenticationToken) return null;
        String name = auth.getName();
        return (name != null && !"anonymousUser".equals(name)) ? name : null;
    }

    
    private void ensureUserRoleCanFavorite(String roleHeader) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean hasRoleUsuario = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_USUARIO".equalsIgnoreCase(a.getAuthority()) || ROLE_USUARIO.equalsIgnoreCase(a.getAuthority()));

        if (!hasRoleUsuario) {
            if (roleHeader != null && roleHeader.equalsIgnoreCase(ROLE_USUARIO)) return; 
            
            if (roleHeader != null && roleHeader.equalsIgnoreCase("ROLE_USUARIO")) return;
        
            throw new AccessDeniedException("Los creadores/administradores no pueden usar favoritos");
        }
    }


    
    private boolean canFavorite(String contenidoId) {
        Contenido c = mongoTemplate.findById(contenidoId, Contenido.class);
        if (c == null) throw new AccessDeniedException("Contenido no disponible");

        List<ListaPublica> listas = listaPublicaDAO.findByContenidosIds(contenidoId);
        boolean enPrivada = listas.stream().anyMatch(lp -> !lp.isPublica());
        return !enPrivada;
    }

}

