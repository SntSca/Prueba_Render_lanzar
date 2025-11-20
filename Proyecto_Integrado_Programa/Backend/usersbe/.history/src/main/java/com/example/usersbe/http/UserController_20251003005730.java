package com.example.usersbe.http;

import com.example.usersbe.services.UserService;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;


@RestController
@RequestMapping("users")
@CrossOrigin("*")
public class UserController {

    @Autowired
    private UserService userService;

    private static final java.util.regex.Pattern EMAIL_RX =
        java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    @PostMapping("/Registrar")
    public void registrar(@RequestBody Map<String, String> info) {
        String[] oblig = {"nombre","apellidos","email","fechaNac","pwd","pwd2","role"};
        for (String campo : oblig) {
            if (!info.containsKey(campo) || info.get(campo) == null || info.get(campo).trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Falta el campo: " + campo);
            }
        }

        String nombre   = info.get("nombre").trim();
        String apellidos= info.get("apellidos").trim();
        String alias    = info.getOrDefault("alias","").trim();
        String email    = info.get("email").trim();
        String fechaNac = info.get("fechaNac").trim();
        String pwd      = info.get("pwd");
        String pwd2     = info.get("pwd2");
        boolean vip     = "true".equalsIgnoreCase(info.getOrDefault("vip","false"));
        String foto     = info.getOrDefault("foto", null);
        String roleStr  = info.get("role").trim();

        // Guardar la foto en disco y mantener solo el nombre
        String nombreFoto = null;
        if (foto != null && !foto.isEmpty()) {
            try {
                if (foto.startsWith("data:image")) {
                    foto = foto.substring(foto.indexOf(",") + 1);
                }
                foto = foto.replaceAll("\\s+", "");
                foto = foto.replace('-', '+').replace('_', '/');

// Añadir padding si hace falta
int padding = foto.length() % 4;
if (padding > 0) {
    foto += "=".repeat(4 - padding);

                byte[] bytes = java.util.Base64.getDecoder().decode(foto);

                // Crear carpeta si no existe
                java.nio.file.Path uploadPath = java.nio.file.Paths.get("src/main/resources/fotos/");
                if (!java.nio.file.Files.exists(uploadPath)) {
                    java.nio.file.Files.createDirectories(uploadPath);
                }

                // Generar nombre único para la foto
                String extension = ".jpg"; // Cambiar según el tipo real si lo tienes
                String fileName = java.util.UUID.randomUUID().toString() + extension;

                java.nio.file.Path destino = uploadPath.resolve(fileName);
                java.nio.file.Files.write(destino, bytes);

                nombreFoto = fileName; // Solo el nombre para la BD
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error al guardar la foto: " + e.getMessage());
            }
        }

        // Validaciones de email y contraseña
        if (!EMAIL_RX.matcher(email).matches())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email no válido");

        if (!pwd.equals(pwd2))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las contraseñas no coinciden");

        String pwdIssue = firstPasswordIssue(pwd);
        if (pwdIssue != null)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La contraseña debe contener " + pwdIssue);

        // Validación de fecha de nacimiento
        java.time.LocalDate fnac;
        try {
            fnac = java.time.LocalDate.parse(fechaNac);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Formato de fecha inválido (YYYY-MM-DD)");
        }
        if (fnac.isAfter(java.time.LocalDate.now()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La fecha de nacimiento no puede ser futura");

        // Determinar el rol
        com.example.usersbe.model.User.Role role;
        String norm = roleStr.trim().toUpperCase().replace("Á","A").replace("É","E")
                    .replace("Í","I").replace("Ó","O").replace("Ú","U");
        if ("USUARIO".equals(norm)) {
            role = com.example.usersbe.model.User.Role.USUARIO;
        } else if ("GESTOR DE CONTENIDO".equals(norm) || "GESTOR_CONTENIDO".equals(norm)) {
            role = com.example.usersbe.model.User.Role.GESTOR_CONTENIDO;
        } else if ("ADMINISTRADOR".equals(norm)) {
            role = com.example.usersbe.model.User.Role.ADMINISTRADOR;
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Rol no permitido. Usa: USUARIO | GESTOR DE CONTENIDO | ADMINISTRADOR");
        }

        // Registrar usuario
        try {
            userService.registrar(
                nombre, apellidos, alias, email, fechaNac, pwd, vip, nombreFoto, role
            );
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }


    private static String firstPasswordIssue(String pwd) {
        if (pwd == null || pwd.length() < 8) return "al menos 8 caracteres";
        if (!pwd.chars().anyMatch(Character::isUpperCase)) return "una letra mayúscula";
        if (!pwd.chars().anyMatch(Character::isLowerCase)) return "una letra minúscula";
        if (!pwd.chars().anyMatch(Character::isDigit))     return "un número";
        if (!pwd.matches(".*[!@#$%^&*(),.?\":{}|<>].*"))  return "un carácter especial";
        return null;
    }
}

