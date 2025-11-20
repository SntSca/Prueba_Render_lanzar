package com.EsiMediaG03.http;


import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.EsiMediaG03.dto.ModificarContenidoRequest;
import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("Contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {
 
    private static final long DEFAULT_CHUNK_SIZE = 1024L * 1024L;
    private final ContenidoService contenidoService;

    public ContenidoController(ContenidoService contenidoService) {
        this.contenidoService = contenidoService;
    }

    @PostMapping("/AnadirContenido")
    public ResponseEntity<Contenido> anadirContenido(@RequestBody Contenido contenido) throws Throwable {
        Contenido resultado = contenidoService.anadirContenido(contenido);
        return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
    }

    @GetMapping("/ListarContenidos")
    public ResponseEntity<List<Contenido>> listarContenidos() {
        List<Contenido> lista = contenidoService.listarContenidos();
        return ResponseEntity.ok(lista);
    }


    @GetMapping("/ReproducirContenido/{id}")
    public ResponseEntity<?> stream(@PathVariable String id,
                                    @RequestHeader HttpHeaders headers,
                                    @RequestHeader(value="X-User-Role", required=false) String userRole,
                                    @RequestHeader(value="X-User-Email", required=false) String userEmail,
                                    @RequestHeader(value="X-User-Vip", required=false) Boolean userVip,
                                    @RequestHeader(value="X-User-Birthdate", required=false) String userBirthdateIso,
                                    @RequestHeader(value="X-User-Age", required=false) Integer userAge
                                    ) throws Exception {
        Integer age = resolveAge(userBirthdateIso, userAge);

        StreamingTarget target = contenidoService.resolveStreamingTarget(id, userVip, age);

        contenidoService.registrarReproduccionSiUsuario(id, userRole);

        if (target.isExternalRedirect()) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, target.externalUrl())
                    .build();
        }

        Path file = target.path();
        long fileSize = target.length();
        MediaType mediaType = resolveMediaType(target.mimeType(), file);

        List<HttpRange> ranges = headers.getRange();
        if (ranges == null || ranges.isEmpty()) {
            HttpHeaders h = commonHeaders(mediaType);
            h.setContentLength(fileSize);
            InputStreamResource body = new InputStreamResource(Files.newInputStream(file));
            return new ResponseEntity<>(body, h, HttpStatus.OK);
        }

        HttpRange range = ranges.get(0);
        long start = range.getRangeStart(fileSize);
        long end = range.getRangeEnd(fileSize);

        if (start >= fileSize || end >= fileSize || start > end) {
            HttpHeaders h = commonHeaders(mediaType);
            h.add(HttpHeaders.CONTENT_RANGE, "bytes */" + fileSize);
            return new ResponseEntity<>(null, h, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
        }

        long rangeLength = end - start + 1;
        long chunk = Math.min(rangeLength, DEFAULT_CHUNK_SIZE);

        InputStream is = Files.newInputStream(file);
        is.skip(start);
        InputStreamResource body = new InputStreamResource(new LimitedInputStream(is, chunk));

        HttpHeaders h = commonHeaders(mediaType);
        h.set(HttpHeaders.CONTENT_RANGE, String.format("bytes %d-%d/%d", start, start + chunk - 1, fileSize));
        h.setContentLength(chunk);

        return new ResponseEntity<>(body, h, HttpStatus.PARTIAL_CONTENT);
    }

    @RequestMapping(value = "/ReproducirContenido/{id}", method = RequestMethod.HEAD)
    public ResponseEntity<Void> head(@PathVariable String id,
                                 @RequestHeader(value = "X-User-Vip", required = false) Boolean userVip,
                                 @RequestHeader(value = "X-User-Birthdate", required = false) String userBirthdateIso,
                                 @RequestHeader(value = "X-User-Age", required = false) Integer userAge) throws Exception {
        Integer age = resolveAge(userBirthdateIso, userAge);
        StreamingTarget target = contenidoService.resolveStreamingTarget(id, userVip, age);
        HttpHeaders h = new HttpHeaders();
        if (target.isExternalRedirect()) {
            h.setContentType(resolveMediaType(target.mimeType(), null));
            return new ResponseEntity<>(h, HttpStatus.OK);
        }
        h.setContentType(resolveMediaType(target.mimeType(), target.path()));
        h.setContentLength(target.length());
        h.set(HttpHeaders.ACCEPT_RANGES, "bytes");
        return new ResponseEntity<>(h, HttpStatus.OK);
    }

    private HttpHeaders commonHeaders(MediaType mediaType) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(mediaType);
        h.set(HttpHeaders.ACCEPT_RANGES, "bytes");
        return h;
    }
    @PutMapping("/ModificarContenido/{id}")
    public ResponseEntity<Contenido> modificarContenido(
            @PathVariable String id,
            @RequestBody ModificarContenidoRequest cambios,
            @RequestHeader("X-User-Email") String userEmail,
            @RequestHeader("X-User-Role") String userRole,
            @RequestHeader("X-Creator-Tipo") String creatorTipo // "AUDIO" | "VIDEO"
    ) throws Throwable {
        Contenido.Tipo requesterTipo = Contenido.Tipo.valueOf(creatorTipo.toUpperCase());
        Contenido actualizado = contenidoService.modificarContenido(id, cambios, userEmail, userRole, requesterTipo);
        return ResponseEntity.ok(actualizado);
    }

    @DeleteMapping("/EliminarContenido/{id}")
    public ResponseEntity<Void> eliminarContenido(
            @PathVariable String id,
            @RequestHeader("X-User-Email") String userEmail,
            @RequestHeader("X-User-Role") String userRole,
            @RequestHeader("X-Creator-Tipo") String creatorTipo // "AUDIO" | "VIDEO"
    ) {
        Contenido.Tipo requesterTipo = Contenido.Tipo.valueOf(creatorTipo.toUpperCase());
        contenidoService.eliminarContenido(id, userEmail, userRole, requesterTipo);
        return ResponseEntity.noContent().build();
    }

    private MediaType resolveMediaType(String mimeFromModel, Path file) {
        try {
            if (StringUtils.hasText(mimeFromModel)) return MediaType.parseMediaType(mimeFromModel);
            if (file != null) {
                String probe = Files.probeContentType(file);
                if (probe != null) return MediaType.parseMediaType(probe);
            }
        } catch (Exception ignored) {}
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    static class LimitedInputStream extends java.io.FilterInputStream {
        private long remaining;
        protected LimitedInputStream(InputStream in, long limit) {
            super(in);
            this.remaining = limit;
        }
        @Override public int read() throws java.io.IOException {
            if (remaining <= 0) return -1;
            int b = super.read();
            if (b != -1) remaining--;
            return b;
        }
        @Override public int read(byte[] b, int off, int len) throws java.io.IOException {
            if (remaining <= 0) return -1;
            len = (int)Math.min(len, remaining);
            int read = super.read(b, off, len);
            if (read > 0) remaining -= read;
            return read;
        }
    }

    private Integer resolveAge(String birthIso, Integer ageDirect) {
        if (ageDirect != null && ageDirect > 0) return ageDirect;
        if (birthIso == null || birthIso.isBlank()) return null;
        try {
            return com.EsiMediaG03.services.ContenidoService.calcularEdad(java.time.LocalDate.parse(birthIso));
        } catch (Exception e) {
            return null;
        }
    }
    
}
