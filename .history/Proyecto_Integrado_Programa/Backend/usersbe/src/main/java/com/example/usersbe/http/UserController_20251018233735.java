package com.example.usersbe.http;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.usersbe.dto.AdminCreationRequest;
import com.example.usersbe.exceptions.ForbiddenException;
import com.example.usersbe.exceptions.ValidationException;
import com.example.usersbe.model.User;
import com.example.usersbe.services.UserService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("users")
@CrossOrigin("*")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    private static final String FIELD_EMAIL = "email";
    private static final String FIELD_MESSAGE = "message";
    private static final String FIELD_NOMBRE = "nombre";
    private static final String FIELD_APELLIDOS = "apellidos";
    private static final String FIELD_ALIAS = "alias";
    private static final String FIELD_FECHA_NAC = "fechaNac";
    private static final String FIELD_PWD = "pwd";
    private static final String FIELD_PWD2 = "pwd2";
    private static final String FIELD_ROLE = "role";
    private static final String FIELD_FOTO = "foto";
    private static final String FIELD_DESCRIPCION = "descripcion";
    private static final String FIELD_ESPECIALIDAD = "especialidad";
    private static final String FIELD_TIPO_CONTENIDO = "tipoContenido";
    private static final String FIELD_DEPARTAMENTO = "departamento";
    private static final String STATUS = "status";


    private static final int MAX_ATTEMPTS = 3;
    private static final long WINDOW_MS = 10L * 60 * 1000;
    private final File logFile = new File("logs/forgot-password.log");

    private static final java.util.regex.Pattern EMAIL_RX = java.util.regex.Pattern
            .compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    @GetMapping("/check-alias/{alias}")
    public Map<String, Object> checkAlias(@PathVariable("alias") String alias) {
        boolean available = userService.isAliasAvailable(trim(alias));
        return Map.of("available", available);
    }
    @GetMapping("/check-email/{email}")
    public Map<String, Object> checkEmail(@PathVariable("email") String email) {
        boolean available = userService.isEmailAvailable(trim(email).toLowerCase(Locale.ROOT));
        return Map.of("available", available);
    }

    @PostMapping("/Registrar")
    public void registrar(@RequestBody Map<String, String> info) {
        validarCamposObligatorios(
                info,
                FIELD_NOMBRE, FIELD_APELLIDOS, FIELD_EMAIL, FIELD_FECHA_NAC,
                FIELD_PWD, FIELD_PWD2, FIELD_ROLE, FIELD_ALIAS, FIELD_FOTO);

        final String nombre = trim(info.get(FIELD_NOMBRE));
        final String apellidos = trim(info.get(FIELD_APELLIDOS));
        final String alias = trim(info.get(FIELD_ALIAS));
        final String email = trim(info.get(FIELD_EMAIL)).toLowerCase(Locale.ROOT);
        final String fechaNac = trim(info.get(FIELD_FECHA_NAC));
        final String pwd = info.get(FIELD_PWD);
        final String pwd2 = info.get(FIELD_PWD2);
        final boolean vip = Boolean.parseBoolean(info.getOrDefault("vip", "false"));
        final String foto = trim(info.get(FIELD_FOTO));

        validarEmail(email);
        validarContrasena(pwd, pwd2);

        final User.Role role = parseRole(trim(info.get(FIELD_ROLE)));

        String descripcion = null;
        String especialidad = null;
        User.TipoContenido tipoContenido = null;
        String departamento = null;

        if (role == User.Role.GESTOR_CONTENIDO) {
            validarCamposObligatorios(info, FIELD_DESCRIPCION, FIELD_ESPECIALIDAD, FIELD_TIPO_CONTENIDO);
            descripcion = trim(info.get(FIELD_DESCRIPCION));
            especialidad = trim(info.get(FIELD_ESPECIALIDAD));
            tipoContenido = parseTipoContenido(trim(info.get(FIELD_TIPO_CONTENIDO)));
        } else if (role == User.Role.ADMINISTRADOR) {
            departamento = trimOrNull(info.get(FIELD_DEPARTAMENTO));
        }

        try {
            userService.registrar(
                    nombre, apellidos, alias, email, fechaNac, pwd, vip, foto, role,
                    descripcion, especialidad, tipoContenido,
                    departamento);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static String trimOrNull(String s) {
        return s == null ? null : s.trim();
    }

    private void validarCamposObligatorios(Map<String, String> info, String... campos) {
        for (String campo : campos) {
            if (!info.containsKey(campo) || info.get(campo) == null || info.get(campo).trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Falta el campo: " + campo);
            }
        }
    }

    private void validarEmail(String email) {
        if (!EMAIL_RX.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email no válido");
        }
    }

    private void validarContrasena(String pwd, String pwd2) {
        if (!String.valueOf(pwd).equals(String.valueOf(pwd2))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las contraseñas no coinciden");
        }
        String issue = firstPasswordIssue(pwd);
        if (issue != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La contraseña debe contener " + issue);
        }
    }

    private static String firstPasswordIssue(String pwd) {
        if (pwd == null || pwd.length() < 8)
            return "al menos 8 caracteres";
        if (!pwd.chars().anyMatch(Character::isUpperCase))
            return "una letra mayúscula";
        if (!pwd.chars().anyMatch(Character::isLowerCase))
            return "una letra minúscula";
        if (!pwd.chars().anyMatch(Character::isDigit))
            return "un número";
        if (!pwd.matches(".*[!@#$%^&*(),.?\":{}|<>_\\-].*"))
            return "un carácter especial";
        return null;
    }

    private User.Role parseRole(String roleStr) {
        String norm = roleStr.toUpperCase(Locale.ROOT)
                .replace("Á", "A").replace("É", "E")
                .replace("Í", "I").replace("Ó", "O").replace("Ú", "U");

        return switch (norm) {
            case "USUARIO" -> User.Role.USUARIO;
            case "GESTOR DE CONTENIDO", "GESTOR_CONTENIDO" -> User.Role.GESTOR_CONTENIDO;
            case "ADMINISTRADOR" -> User.Role.ADMINISTRADOR;
            default -> throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Rol no permitido. Usa: USUARIO | GESTOR DE CONTENIDO | ADMINISTRADOR");
        };
    }

    private User.TipoContenido parseTipoContenido(String tipo) {
        String norm = Optional.ofNullable(tipo)
                .map(t -> t.trim().toUpperCase(Locale.ROOT))
                .orElse("");
        return switch (norm) {
            case "AUDIO" -> User.TipoContenido.AUDIO;
            case "VIDEO" -> User.TipoContenido.VIDEO;
            default -> throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tipoContenido debe ser AUDIO o VIDEO");
        };
    }

    private int countRecentAttempts(String ip) {
        if (!logFile.exists())
            return 0;
        int count = 0;
        long now = System.currentTimeMillis();

        try (BufferedReader br = new BufferedReader(new FileReader(logFile))) {
            String line;
            while ((line = br.readLine()) != null) {
                String[] parts = line.split("\\|");
                if (parts.length < 2)
                    continue;
                long timestamp = Long.parseLong(parts[0]);
                String logIp = parts[1];
                if (logIp.equals(ip) && now - timestamp <= WINDOW_MS) {
                    count++;
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return count;
    }

    private void logAttempt(String ip) {
        try {
            logFile.getParentFile().mkdirs();
            try (FileWriter fw = new FileWriter(logFile, true)) {
                fw.write(System.currentTimeMillis() + "|" + ip + "\n");
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Object> forgotPassword(HttpServletRequest request, @RequestBody Map<String, String> body) {
        String ip = request.getRemoteAddr();

        int attempts = countRecentAttempts(ip);
        if (attempts >= MAX_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Has superado el límite de intentos. Intenta de nuevo más tarde.");
        }

        logAttempt(ip);

        try {
            String email = Optional.ofNullable(body.get(FIELD_EMAIL))
                    .map(String::trim)
                    .map(s -> s.toLowerCase(Locale.ROOT))
                    .orElse("");

            userService.sendPasswordRecoveryEmail(email);
            return ResponseEntity
                    .ok(Map.of(FIELD_MESSAGE, "Si el email existe, se ha enviado un enlace de recuperación."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(FIELD_MESSAGE, e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {
        try {
            String token = body.get("token");
            String newPassword = body.get("newPassword");
            userService.resetPassword(token, newPassword);
            return ResponseEntity.ok(Map.of(FIELD_MESSAGE, "Contraseña actualizada correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of(FIELD_MESSAGE, e.getMessage()));
        }
    }

    @GetMapping("/listarUsuarios")
    public List<User> getAll() {
        return userService.listarUsuarios();
    }



    @GetMapping("/obtenerPerfilUsuario")
    public ResponseEntity<User> getUserByEmail(@RequestParam String email) {
        User u = userService.getUserByEmail(email);
        return ResponseEntity.ok(u);
    }

    @PutMapping("/modificarPerfilCreadorContenido")
    public User updateCreador(@RequestBody Map<String, Object> body){
        try{
            String email = (String) body.get(FIELD_EMAIL);
            if (email == null || email.trim().isEmpty()){
                throw new IllegalArgumentException("El email es obligatorio");
            }

            String nombre = (String) body.get(FIELD_NOMBRE);
            String apellidos = (String) body.get(FIELD_APELLIDOS);
            String alias = (String) body.get(FIELD_ALIAS);
            String descripcion = (String) body.get(FIELD_DESCRIPCION);
            String especialidad = (String) body.get(FIELD_ESPECIALIDAD);
            String tipoContenido = (String) body.get("tipoContenido");
            String foto = (String) body.get("foto");

            return userService.updateCreadorContenido(
                email,
                nombre,
                apellidos,
                alias,
                descripcion,
                especialidad,
                tipoContenido,
                foto
            );

        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (ValidationException | ForbiddenException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) { 
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    @PutMapping("/modificarPerfilUsuario")
    public User updateUser(@RequestBody Map<String, Object> body) {
        try {
        
            String email = (String) body.get("email");
            if (email == null || email.trim().isEmpty()) {
                throw new IllegalArgumentException("El email es obligatorio");
            }

            String nombre = (String) body.get("nombre");
            String apellidos = (String) body.get("apellidos");
            String alias = (String) body.get("alias");
            String foto = (String) body.get("foto");
            Boolean vip = (Boolean) body.get("vip");

            return userService.updateProfile(
                    email,
                    nombre,
                    apellidos,
                    alias,
                    foto,
                    vip);

        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (ValidationException | ForbiddenException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) { 
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @GetMapping("/admin/creators")
    public List<User> listarCreadores(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean blocked) {
        return userService.listarCreadores(search, blocked);
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PatchMapping("/admin/creators/{id}")
    public ResponseEntity<Object> actualizarCreador(@PathVariable String id,
            @RequestBody Map<String, String> body) {
        try {
            String alias = body.get("alias");
            String nombre = body.get("nombre");
            String apellidos = body.get("apellidos");
            String email = body.get(FIELD_EMAIL);
            String foto = body.get("foto");

            if (email != null && !email.isBlank()) {
                validarEmail(email.trim().toLowerCase(Locale.ROOT));
            }

            User actualizado = userService.actualizarCreador(id,
                    alias == null ? null : alias.trim(),
                    nombre == null ? null : nombre.trim(),
                    apellidos == null ? null : apellidos.trim(),
                    email == null ? null : email.trim().toLowerCase(Locale.ROOT),
                    foto == null ? null : foto.trim());

            return ResponseEntity.ok(actualizado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(FIELD_MESSAGE, e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/creators/{id}/block")
    public ResponseEntity<Object> bloquear(@PathVariable String id) {
        try {
            User u = userService.bloquearCreador(id);
            return ResponseEntity.ok(u);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/creators/{id}/unblock")
    public ResponseEntity<Object> desbloquear(@PathVariable String id) {
        try {
            User u = userService.desbloquearCreador(id);
            return ResponseEntity.ok(u);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @DeleteMapping("/admin/creators/{id}")
    public ResponseEntity<Object> eliminar(@PathVariable String id) {
        try {
            userService.eliminarCreador(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/creators")
    public ResponseEntity<Object> crearCreadorPorAdmin(@RequestBody Map<String, String> body) {
        validarCamposObligatorios(body,
                "nombre", "apellidos", FIELD_EMAIL, "alias", "pwd", "pwd2", "foto",
                FIELD_DESCRIPCION, FIELD_ESPECIALIDAD, FIELD_TIPO_CONTENIDO);

        final String nombre = trim(body.get("nombre"));
        final String apellidos = trim(body.get("apellidos"));
        final String alias = trim(body.get("alias"));
        final String email = trim(body.get(FIELD_EMAIL)).toLowerCase(Locale.ROOT);
        final String pwd = body.get("pwd");
        final String pwd2 = body.get("pwd2");

        validarEmail(email);
        validarContrasena(pwd, pwd2);

        String fechaNac = Optional.ofNullable(body.get(FIELD_FECHA_NAC)).map(String::trim).filter(s -> !s.isEmpty())
                .orElse("2000-01-01");
        final String foto = trim(body.getOrDefault("foto", "/static/fotos/image.png"));
        final boolean vip = Boolean.parseBoolean(body.getOrDefault("vip", "false"));

        final String descripcion = trim(body.get(FIELD_DESCRIPCION));
        final String especialidad = trim(body.get("especialidad"));
        final User.TipoContenido tipoContenido = parseTipoContenido(trim(body.get("tipoContenido")));

        try {
            userService.registrar(
                    nombre, apellidos, alias, email, fechaNac, pwd,
                    vip, foto,
                    User.Role.GESTOR_CONTENIDO,
                    descripcion, especialidad, tipoContenido);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(STATUS, "ok"));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PatchMapping("/admin/admins/{id}")
    public ResponseEntity<Object> actualizarAdmin(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        try {
            String alias = body.get(FIELD_ALIAS);
            String nombre = body.get(FIELD_NOMBRE);
            String apellidos = body.get(FIELD_APELLIDOS);
            String foto = body.get(FIELD_FOTO);
            String departamento = body.get(FIELD_DEPARTAMENTO);
            if (body.containsKey(FIELD_EMAIL)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "No se permite modificar el email del administrador."));
            }
            User actualizado = userService.actualizarAdmin(
                    id,
                    alias == null ? null : alias.trim(),
                    nombre == null ? null : nombre.trim(),
                    apellidos == null ? null : apellidos.trim(),
                    null,
                    foto == null ? null : foto.trim(),
                    departamento == null ? null : departamento.trim());
            Map<String, Object> response = Map.of(
                    "id", actualizado.getId(),
                    FIELD_ALIAS, actualizado.getAlias(),
                    FIELD_NOMBRE, actualizado.getNombre(),
                    FIELD_APELLIDOS, actualizado.getApellidos(),
                    FIELD_EMAIL, actualizado.getEmail(),
                    "foto", actualizado.getFoto(),
                    FIELD_DEPARTAMENTO, actualizado.getDepartamento(),
                    "message", "Administrador actualizado correctamente.");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/admins/{id}/block")
    public ResponseEntity<Object> bloquearAdmin(@PathVariable String id) {
        try {
            User u = userService.bloquearAdmin(id);
            return ResponseEntity.ok(u);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/admins/{id}/unblock")
    public ResponseEntity<Object> desbloquearAdmin(@PathVariable String id) {
        try {
            User u = userService.desbloquearAdmin(id);
            return ResponseEntity.ok(u);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @DeleteMapping("/admin/admins/{id}")
    public ResponseEntity<Object> eliminarAdmin(@PathVariable String id) {
        try {
            userService.eliminarAdmin(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/admins")
    public ResponseEntity<Object> crearAdminPorAdmin(@RequestBody Map<String, String> body) {
        validarCamposObligatorios(body,
                FIELD_NOMBRE, FIELD_APELLIDOS, FIELD_EMAIL, FIELD_ALIAS, FIELD_PWD, FIELD_PWD2, FIELD_FOTO);

        final String nombre = trim(body.get(FIELD_NOMBRE));
        final String apellidos = trim(body.get(FIELD_APELLIDOS));
        final String alias = trim(body.get(FIELD_ALIAS));
        final String email = trim(body.get(FIELD_EMAIL)).toLowerCase(Locale.ROOT);
        final String pwd = body.get(FIELD_PWD);
        final String pwd2 = body.get(FIELD_PWD2);
        final String fechaNac = Optional.ofNullable(body.get(FIELD_FECHA_NAC))
                .map(String::trim).filter(s -> !s.isEmpty()).orElse("2000-01-01");
        final String foto = trim(body.getOrDefault(FIELD_FOTO, "/static/fotos/image.png"));
        final String departamento = trim(body.getOrDefault(FIELD_DEPARTAMENTO, ""));

        validarEmail(email);
        validarContrasena(pwd, pwd2);

        AdminCreationRequest req = new AdminCreationRequest();
        req.setNombre(nombre);
        req.setApellidos(apellidos);
        req.setAlias(alias);
        req.setEmail(email);
        req.setFechaNac(fechaNac);
        req.setPwd(pwd);
        req.setFoto(foto);
        req.setDepartamento(departamento);

        User pending = userService.solicitarCreacionAdmin(req);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                STATUS, "pending",
                "userId", pending.getId(),
                "message", "Solicitud enviada al superAdmin para aprobación"));
    }

    @GetMapping("/admin/admins/approve")
    public ResponseEntity<Object> aprobarAdminPorToken(@RequestParam("token") String token) {
        try {
            User u = userService.aprobarAdminPorToken(token);
            return ResponseEntity.ok(Map.of("status", "approved", "Email", u.getEmail()));
        } catch (com.example.usersbe.exceptions.ExpiredTokenException e) {
            return ResponseEntity.status(HttpStatus.GONE).body(Map.of("message", e.getMessage()));
        } catch (com.example.usersbe.exceptions.InvalidTokenException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/admin/admins/reject")
    public ResponseEntity<Object> rechazarAdminPorToken(@RequestParam("token") String token) {
        try {
            User u = userService.rechazarAdminPorToken(token);
            return ResponseEntity.ok(Map.of("status", "rejected", "Email", u.getEmail()));
        } catch (com.example.usersbe.exceptions.ExpiredTokenException e) {
            return ResponseEntity.status(HttpStatus.GONE).body(Map.of("message", e.getMessage()));
        } catch (com.example.usersbe.exceptions.InvalidTokenException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PatchMapping("/admin/users/{id}")
    public ResponseEntity<Object> actualizarUsuario(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        try {
            String alias     = body.get(FIELD_ALIAS);
            String nombre    = body.get(FIELD_NOMBRE);
            String apellidos = body.get(FIELD_APELLIDOS);
            String email     = body.get(FIELD_EMAIL);
            String foto      = body.get(FIELD_FOTO);
            String fechaNac  = body.get(FIELD_FECHA_NAC);

            if (email != null && !email.isBlank()) {
                validarEmail(email.trim().toLowerCase(Locale.ROOT));
            }

            User actualizado = userService.actualizarUsuario(
                    id,
                    alias == null ? null : alias.trim(),
                    nombre == null ? null : nombre.trim(),
                    apellidos == null ? null : apellidos.trim(),
                    email == null ? null : email.trim().toLowerCase(Locale.ROOT),
                    foto == null ? null : foto.trim(),
                    fechaNac == null ? null : fechaNac.trim()
            );

            return ResponseEntity.ok(actualizado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/users/{id}/block")
    public ResponseEntity<Object> bloquearUsuario(@PathVariable String id) {
        try {
            User u = userService.bloquearUsuario(id);
            return ResponseEntity.ok(u);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @PostMapping("/admin/users/{id}/unblock")
    public ResponseEntity<Object> desbloquearUsuario(@PathVariable String id) {
        try {
            User u = userService.desbloquearUsuario(id);
            return ResponseEntity.ok(u);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMINISTRADOR')")
    @DeleteMapping("/admin/users/{id}")
    public ResponseEntity<Object> eliminarUsuario(@PathVariable String id) {
        try {
            userService.eliminarUsuario(id); 
            return ResponseEntity.noContent().build();
        } catch (com.example.usersbe.exceptions.UserDeletionNotAllowedException e) {
        
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/darDeBajaUsuario")
    public ResponseEntity<String> darDeBajaUsuario(@RequestParam String email) {
        try {
            userService.darDeBajaUsuario(email);
            return ResponseEntity.ok("Usuario eliminado correctamente");
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error al eliminar usuario");
        }
    }
}