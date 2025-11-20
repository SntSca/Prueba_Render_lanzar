package com.example.usersbe.services;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.dto.AdminCreationRequest;
import com.example.usersbe.exceptions.AdminNotFoundException;
import com.example.usersbe.exceptions.EmailSendException;
import com.example.usersbe.exceptions.ExpiredTokenException;
import com.example.usersbe.exceptions.ForbiddenException;
import com.example.usersbe.exceptions.InvalidPasswordException;
import com.example.usersbe.exceptions.InvalidRoleException;
import com.example.usersbe.exceptions.InvalidTokenException;
import com.example.usersbe.exceptions.MissingSuperAdminEmailConfigException;
import com.example.usersbe.exceptions.NotAnAdminException;
import com.example.usersbe.exceptions.SuperAdminProtectionException;
import com.example.usersbe.exceptions.UserDeletionNotAllowedException;
import com.example.usersbe.exceptions.UserNotFoundException;
import com.example.usersbe.model.User;

import jakarta.mail.MessagingException;

@Service
public class UserService {
    
    private static final String TOKEN_NOT_PROVIDED = "Token no proporcionado";
    private static final String INVALID_TOKEN = "Token inválido";
    private static final String EXPIRED_TOKEN = "Token caducado";
    private static final String CREATOR_NOT_FOUND = "El creador no fue encontrado";
    private static final String USER_NOT_A_CREATOR = "El usuario no es un creador";
    private static final String USER_NOT_FOUND = "El usuario no fue encontrado";
    private static final String USER_NOT_A_USER = "El usuario no tiene rol USUARIO";

    private final UserDao userDao;
    private final EmailService emailService;

    @Value("${app.superadmin.email}")
    private String superAdminEmail;

    public UserService(UserDao userDao, EmailService emailService) {
        this.userDao = userDao;
        this.emailService = emailService;
    }

    private String normalizeEmail(String email) {
        return (email == null) ? "" : email.trim().toLowerCase();
    }

    public boolean isAliasAvailable(String aliasRaw) {
        if (aliasRaw == null || aliasRaw.trim().isEmpty()) return false;
        final String alias = aliasRaw.trim();
        return !userDao.existsByAliasIgnoreCase(alias);
    }

    private String hashPassword(String pwd) {
        return org.mindrot.jbcrypt.BCrypt.hashpw(pwd, org.mindrot.jbcrypt.BCrypt.gensalt());
    }

    private String generateToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public void registrar(String nombre, String apellidos, String alias, String email,
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role,
                          String descripcion, String especialidad, User.TipoContenido tipoContenido) {
        registrar(nombre, apellidos, alias, email, fechaNac, pwd, vip, foto, role,
                descripcion, especialidad, tipoContenido, null);
    }

    public boolean isEmailAvailable(String emailNormalizado) {
        if (emailNormalizado == null || emailNormalizado.trim().isEmpty()) return false;
        String email = emailNormalizado.trim().toLowerCase();
        return userDao.findByEmail(email) == null;
    }

    public void registrar(String nombre, String apellidos, String alias, String email,
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role,
                          String descripcion, String especialidad, User.TipoContenido tipoContenido,
                          String departamento) {

        final String emailN = normalizeEmail(email);

        User user = buildUser(
                nombre, apellidos, alias, emailN, fechaNac, pwd, vip, foto, role,
                descripcion, especialidad, tipoContenido, departamento
        );

        userDao.save(user);
    }

    private User buildUser(String nombre, String apellidos, String alias, String email,
                           String fechaNac, String pwd, boolean vip, String foto,
                           User.Role role,
                           String descripcion, String especialidad, User.TipoContenido tipoContenido,
                           String departamento) {

        User user = new User();
        user.setNombre(nombre != null ? nombre.trim() : null);
        user.setApellidos(apellidos != null ? apellidos.trim() : null);
        user.setAlias(alias != null ? alias.trim() : null);
        user.setEmail(email);
        if (fechaNac != null && !fechaNac.isBlank()) user.setFechaNac(LocalDate.parse(fechaNac));
        if (pwd != null) user.setPwd(hashPassword(pwd));
        user.setVip(vip);
        user.setFoto(foto);
        user.setRole(role);
        user.setDepartamento(departamento != null ? departamento.trim() : null);

        if (role == User.Role.GESTOR_CONTENIDO) {
            user.setDescripcion(descripcion);
            user.setEspecialidad(especialidad);
            user.setTipoContenido(tipoContenido);
        }

        if (role == User.Role.ADMINISTRADOR) {
            user.setDepartamento(departamento != null ? departamento.trim() : null);
        }

        return user;
    }

    public void sendPasswordRecoveryEmail(String email) {
        String emailN = normalizeEmail(email);
        User user = userDao.findByEmail(emailN);
        if (user == null) return;

        String token = generateToken();
        user.setResetPasswordToken(token);
        user.setResetPasswordExpires(LocalDateTime.now().plusHours(1));
        userDao.save(user);

        sendRecoveryEmail(user, token);
    }

    private void sendRecoveryEmail(User user, String token) {
        String link = "http://localhost:4200/auth/reset-password?token=" + token;
        String body = generateRecoveryHtml(user.getNombre(), link);
        try {
            emailService.sendMail(user.getEmail(), "Recuperación de contraseña - EsiMedia", body);
        } catch (MessagingException e) {
            throw new EmailSendException("Error enviando correo de recuperación", e);
        }
    }

    private String generateRecoveryHtml(String nombre, String link) {
        return """
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Recuperación de contraseña - EsiMedia</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                background-color: #f4f4f7;
                                color: #333;
                                padding: 20px;
                            }
                            .container {
                                max-width: 600px;
                                margin: 40px auto;
                                background-color: #ffffff;
                                padding: 30px;
                                border-radius: 8px;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                text-align: center;
                            }
                            h1 { color: #333333; }
                            p  { font-size: 16px; line-height: 1.5; }
                            .btn {
                                display: inline-block;
                                padding: 12px 24px;
                                margin-top: 20px;
                                font-size: 16px;
                                color: #ffffff;
                                background-color: #007BFF;
                                text-decoration: none;
                                border-radius: 5px;
                                transition: background-color 0.3s ease;
                            }
                            .btn:hover { background-color: #0056b3; }
                            .footer {
                                margin-top: 30px;
                                font-size: 12px;
                                color: #777;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Recuperación de contraseña</h1>
                            <p>Hola, <strong>%s</strong>,</p>
                            <p>Haz clic en el botón de abajo para restablecer tu contraseña:</p>
                            <a href="%s" class="btn">Restablecer contraseña</a>
                            <p class="footer">Si no solicitaste este correo, puedes ignorarlo.</p>
                        </div>
                    </body>
                </html>
                """.formatted(nombre != null ? nombre : "usuario", link);
    }

    public void resetPassword(String token, String newPassword) {
        User user = getUserByValidToken(token);
        validateNewPassword(newPassword, user.getPwd());

        user.setPwd(hashPassword(newPassword));
        user.setResetPasswordToken(null);
        user.setResetPasswordExpires(null);
        userDao.save(user);
    }

    private User getUserByValidToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            throw new InvalidTokenException(TOKEN_NOT_PROVIDED);
        }
        User user = userDao.findByResetPasswordToken(token.trim());
        if (user == null || user.getResetPasswordExpires() == null) {
            throw new InvalidTokenException(INVALID_TOKEN);
        }
        if (user.getResetPasswordExpires().isBefore(LocalDateTime.now())) {
            throw new ExpiredTokenException(EXPIRED_TOKEN);
        }
        return user;
    }

    private void validateNewPassword(String newPassword, String oldPasswordHash) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new InvalidPasswordException("La nueva contraseña debe tener al menos 8 caracteres");
        }
        if (org.mindrot.jbcrypt.BCrypt.checkpw(newPassword, oldPasswordHash)) {
            throw new InvalidPasswordException("La nueva contraseña no puede ser igual a la anterior");
        }
    }

    public List<User> listarUsuarios() {
        return userDao.findAll();
    }

    public List<User> listarCreadores(String search, Boolean blocked) {
        if (search != null && !search.isBlank()) {
            String q = search.trim();
            if (blocked == null)
                return userDao.searchCreators(User.Role.GESTOR_CONTENIDO, q);
            return userDao.searchCreatorsByBlocked(User.Role.GESTOR_CONTENIDO, q, blocked);
        } else {
            if (blocked == null)
                return userDao.findByRole(User.Role.GESTOR_CONTENIDO);
            return userDao.findByRoleAndBlocked(User.Role.GESTOR_CONTENIDO, blocked);
        }
    }


    public User getUserByEmail(String email) {
        User user = userDao.findByEmail(email);
        if (user == null) {
            throw new UserNotFoundException(USER_NOT_FOUND);
        }
        return user;
    }

    public User actualizarCreador(String id, String alias, String nombre,
                                  String apellidos, String email, String foto) {

        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(CREATOR_NOT_FOUND);
        if (u.getRole() != User.Role.GESTOR_CONTENIDO) throw new InvalidRoleException(USER_NOT_A_CREATOR);

        if (alias != null && !alias.isBlank()) u.setAlias(alias.trim());
        if (nombre != null) u.setNombre(nombre.trim());
        if (apellidos != null) u.setApellidos(apellidos.trim());
        if (email != null && !email.isBlank()) u.setEmail(normalizeEmail(email));
        if (foto != null) u.setFoto(foto);
        if (descripcion != null) u.setDescripcion(descripcion.trim());
            else u.setDescripcion(null); 
        if (especialidad != null) u.setEspecialidad(especialidad.trim());
            else u.setEspecialidad(null);

        return userDao.save(u);
    }

    public User bloquearCreador(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(CREATOR_NOT_FOUND);
        if (u.getRole() != User.Role.GESTOR_CONTENIDO) throw new InvalidRoleException(USER_NOT_A_CREATOR);

        if (Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(true);
        userDao.save(u);
        return u;
    }

    public User desbloquearCreador(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(CREATOR_NOT_FOUND);
        if (u.getRole() != User.Role.GESTOR_CONTENIDO) throw new InvalidRoleException(USER_NOT_A_CREATOR);

        if (!Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(false);
        userDao.save(u);
        return u;
    }

    public void eliminarCreador(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(CREATOR_NOT_FOUND);
        if (u.getRole() != User.Role.GESTOR_CONTENIDO) throw new InvalidRoleException(USER_NOT_A_CREATOR);
        userDao.deleteById(id);
    }

    public User actualizarUsuario(String id,
                                  String alias,
                                  String nombre,
                                  String apellidos,
                                  String email,
                                  String foto) {
        return actualizarUsuario(id, alias, nombre, apellidos, email, foto, null);
    }

    public User actualizarUsuario(String id,
                                  String alias,
                                  String nombre,
                                  String apellidos,
                                  String email,
                                  String foto,
                                  String fechaNac) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(USER_NOT_FOUND);
        if (u.getRole() != User.Role.USUARIO) throw new InvalidRoleException(USER_NOT_A_USER);

        if (alias != null && !alias.isBlank()) u.setAlias(alias.trim());
        if (nombre != null) u.setNombre(nombre.trim());
        if (apellidos != null) u.setApellidos(apellidos.trim());
        if (email != null && !email.isBlank()) u.setEmail(normalizeEmail(email));
        if (foto != null) u.setFoto(foto);
        if (fechaNac != null && !fechaNac.isBlank()) u.setFechaNac(LocalDate.parse(fechaNac.trim()));

        return userDao.save(u);
    }

    public User bloquearUsuario(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(USER_NOT_FOUND);
        if (u.getRole() != User.Role.USUARIO) throw new InvalidRoleException(USER_NOT_A_USER);
        if (Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(true);
        return userDao.save(u);
    }

    public User desbloquearUsuario(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(USER_NOT_FOUND);
        if (u.getRole() != User.Role.USUARIO) throw new InvalidRoleException(USER_NOT_A_USER);
        if (!Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(false);
        return userDao.save(u);
    }

    public void eliminarUsuario(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(USER_NOT_FOUND);
        throw new UserDeletionNotAllowedException("No se permite eliminar usuarios.");
    }

    private boolean isSuperAdmin(User u) {
        if (u == null) return false;
        if (u.getRole() != User.Role.ADMINISTRADOR) return false;
        if (superAdminEmail == null || superAdminEmail.isBlank()) {
            throw new MissingSuperAdminEmailConfigException();
        }
        return superAdminEmail.trim().equalsIgnoreCase(u.getEmail());
    }
    public User actualizarAdmin(String id, String alias, String nombre,
                                String apellidos, String email, String foto,
                                String departamento) {

        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new AdminNotFoundException(id);
        if (u.getRole() != User.Role.ADMINISTRADOR) throw new NotAnAdminException();
        if (nombre != null) u.setNombre(nombre.trim());
        if (apellidos != null) u.setApellidos(apellidos.trim());
        if (email != null && !email.isBlank()) u.setEmail(normalizeEmail(email));
        if (foto != null) u.setFoto(foto);
        if (departamento != null) u.setDepartamento(departamento.trim());

        return userDao.save(u);
    }

    public User bloquearAdmin(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new AdminNotFoundException(id);
        if (u.getRole() != User.Role.ADMINISTRADOR) throw new NotAnAdminException();
        if (isSuperAdmin(u)) throw new SuperAdminProtectionException("bloquear");

        if (Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(true);
        return userDao.save(u);
    }

    public User desbloquearAdmin(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new AdminNotFoundException(id);
        if (u.getRole() != User.Role.ADMINISTRADOR) throw new NotAnAdminException();

        if (!Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(false);
        return userDao.save(u);
    }

    public void eliminarAdmin(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new AdminNotFoundException(id);
        if (u.getRole() != User.Role.ADMINISTRADOR) throw new NotAnAdminException();
        if (isSuperAdmin(u)) throw new SuperAdminProtectionException("eliminar");
        userDao.deleteById(id);
    }

    public User solicitarCreacionAdmin(AdminCreationRequest req) {
        final String emailN = normalizeEmail(req.getEmail());

        User user = buildUser(
                req.getNombre(),
                req.getApellidos(),
                req.getAlias(),
                emailN,
                req.getFechaNac(),
                req.getPwd(),
                false,
                req.getFoto(),
                User.Role.ADMINISTRADOR,
                null, null, null,
                req.getDepartamento()
        );
        userDao.save(user);
        return user;
    }

    public User updateCreadorContenido(String email,
                                       String nombre,
                                       String apellidos,
                                       String alias,
                                       String descripcion,
                                       String especialidad,
                                       String tipoContenido,
                                       String foto) {

        User u = getUserByEmail(email);
        if (u.isBlocked()) throw new ForbiddenException("Usuario bloqueado");

        if (nombre != null) u.setNombre(nombre.trim());
        if (apellidos != null) u.setApellidos(apellidos.trim());
        if (descripcion != null) u.setDescripcion(descripcion.trim());
        if (especialidad != null) u.setEspecialidad(especialidad.trim());
        if (tipoContenido != null) {
            User.TipoContenido tipo = User.TipoContenido.valueOf(tipoContenido.toUpperCase(Locale.ROOT));
            u.setTipoContenido(tipo);
        }
        if (alias != null) u.setAlias(alias.trim());
        if (foto != null) u.setFoto(foto);

        return userDao.save(u);
    }

    public User updateProfile(String email,
                              String nombre,
                              String apellidos,
                              String alias,
                              String foto,
                              Boolean vip) {

        User u = getUserByEmail(email);
        if (u.isBlocked()) throw new ForbiddenException("Usuario bloqueado");

        if (nombre != null) u.setNombre(nombre.trim());
        if (apellidos != null) u.setApellidos(apellidos.trim());
        if (alias != null) u.setAlias(alias.trim());
        if (foto != null) u.setFoto(foto);
        if (vip != null) u.setVip(vip);

        return userDao.save(u);
    }

    public void darDeBajaUsuario(String email) {
        User user = userDao.findByEmail(email);
        if (user == null) throw new UserNotFoundException("Usuario no encontrado");
        userDao.deleteByEmail(email);
    }
}
