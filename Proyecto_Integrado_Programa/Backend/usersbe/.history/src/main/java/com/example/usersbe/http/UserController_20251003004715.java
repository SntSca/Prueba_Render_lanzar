package com.example.usersbe.http;

import com.example.usersbe.services.UserService;
import com.example.usersbe.model.User.Role;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
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
    public void registrar(
            @RequestParam("nombre") String nombre,
            @RequestParam("apellidos") String apellidos,
            @RequestParam(value = "alias", required = false, defaultValue = "") String alias,
            @RequestParam("email") String email,
            @RequestParam("fechaNac") String fechaNac,
            @RequestParam("pwd") String pwd,
            @RequestParam("pwd2") String pwd2,
            @RequestParam("role") String roleStr,
            @RequestParam(value = "vip", required = false, defaultValue = "false") boolean vip,
            @RequestParam(value = "foto", required = false) MultipartFile foto
    ) {

        // Validaciones básicas
        if (!EMAIL_RX.matcher(email).matches())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email no válido");

        if (!pwd.equals(pwd2))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las contraseñas no coinciden");

        String pwdIssue = firstPasswordIssue(pwd);
        if (pwdIssue != null)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La contraseña debe contener " + pwdIssue);

        java.time.LocalDate fnac;
        try {
            fnac = java.time.LocalDate.parse(fechaNac);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Formato de fecha inválido (YYYY-MM-DD)");
        }

        if (fnac.isAfter(java.time.LocalDate.now()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La fecha de nacimiento no puede ser futura");

        Role role = parseRole(roleStr);

        // Guardar foto si se envió
        String fotoRuta = null;
        try {
            if (foto != null && !foto.isEmpty()) {
                Path uploadPath = Paths.get("src/main/resources/fotos/");
                if (!Files.exists(uploadPath)) {
                    Files.createDirectories(uploadPath);
                }

                String fileName = foto.getOriginalFilename();
                Path destino = uploadPath.resolve(fileName);
                Files.copy(foto.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);

                fotoRuta = "fotos/" + fileName; // Ruta relativa que puedes guardar en BD
            }

            // Registrar usuario
            userService.registrar(nombre, apellidos, alias, email, fechaNac, pwd, vip, fotoRuta, role);

        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Error al registrar usuario: " + e.getMessage());
        }
    }

    private Role parseRole(String roleStr) {
        String norm = roleStr.trim().toUpperCase()
                .replace("Á","A").replace("É","E")
                .replace("Í","I").replace("Ó","O").replace("Ú","U");

        return switch (norm) {
            case "USUARIO" -> Role.USUARIO;
            case "GESTOR DE CONTENIDO", "GESTOR_CONTENIDO" -> Role.GESTOR_CONTENIDO;
            case "ADMINISTRADOR" -> Role.ADMINISTRADOR;
            default -> throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Rol no permitido. Usa: USUARIO | GESTOR DE CONTENIDO | ADMINISTRADOR");
        };
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
