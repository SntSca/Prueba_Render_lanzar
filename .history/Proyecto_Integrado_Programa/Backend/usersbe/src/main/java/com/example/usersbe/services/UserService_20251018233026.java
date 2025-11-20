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

    private final UserDao userDao;
    private final EmailService emailService;
    private final EmailOtpService emailOtpService;

    @Value("${app.superadmin.email}")
    private String superAdminEmail;

    public UserService(UserDao userDao, EmailService emailService, EmailOtpService emailOtpService) {
        this.userDao = userDao;
        this.emailService = emailService;
        this.emailOtpService = emailOtpService;
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
        boolean hasSearch = (search != null && !search.isBlank());
        if (hasSearch) {
            String q = search.trim();
            if (blocked == null) return userDao.searchCreators(User.Role.GESTOR_CONTENIDO, q);
            return userDao.searchCreatorsByBlocked(User.Role.GESTOR_CONTENIDO, q, blocked);
        } else {
            if (blocked == null) return userDao.findByRole(User.Role.GESTOR_CONTENIDO);
            return userDao.findByRoleAndBlocked(User.Role.GESTOR_CONTENIDO, blocked);
        }
    }

    public User getUserByEmail(String email) {
        User user = userDao.findByEmail(email);
        if (user == null) {
            throw new RuntimeException("Usuario no encontrado");
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
        if (u == null) throw new UserNotFoundException("El usuario no fue encontrado");
        if (u.getRole() != User.Role.USUARIO) throw new InvalidRoleException("El usuario no tiene rol USUARIO");

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
        if (u == null) throw new UserNotFoundException("El usuario no fue encontrado");
        if (u.getRole() != User.Role.USUARIO) throw new InvalidRoleException("El usuario no tiene rol USUARIO");
        if (Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(true);
        return userDao.save(u);
    }

    public User desbloquearUsuario(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException("El usuario no fue encontrado");
        if (u.getRole() != User.Role.USUARIO) throw new InvalidRoleException("El usuario no tiene rol USUARIO");
        if (!Boolean.TRUE.equals(u.isBlocked())) return u;
        u.setBlocked(false);
        return userDao.save(u);
    }

    public void eliminarUsuario(String id) {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException("El usuario no fue encontrado");
        throw new UserDeletionNotAllowedException("No se puede eliminar a usuarios");
    }

    private boolean isSuperAdmin(User u) {
        if (u == null) return false;
        if (u.getRole() != User.Role.ADMINISTRADOR) return false;
        if (superAdminEmail == null || superAdminEmail.isBlank()) {
            throw new MissingSuperAdminEmailConfigException();
        }
        return superAdminEmail.trim().equalsIgnoreCase(u.getEmail());
    }

    public String resolveSuperAdminEmailOrThrow() {
        if (superAdminEmail == null || superAdminEmail.isBlank()) {
            throw new MissingSuperAdminEmailConfigException();
        }
        String email = superAdminEmail.trim().toLowerCase();
        User u = userDao.findByEmail(email);
        if (u == null || u.getRole() != User.Role.ADMINISTRADOR) {
            throw new AdminNotFoundException("superAdmin: " + email);
        }
        return email;
    }

    public void notifySuperAdminOnAdminLogin(User adminUser, String ip) {
        if (adminUser == null) return;
        if (adminUser.getRole() != User.Role.ADMINISTRADOR) return;

        String to = resolveSuperAdminEmailOrThrow();
        emailOtpService.sendAdminLoginAlert(
                to,
                adminUser.getAlias(),
                adminUser.getEmail(),
                ip,
                LocalDateTime.now());
    }

    public User actualizarAdmin(String id, String alias, String nombre,
                                String apellidos, String email, String foto,
                                String departamento) {

        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new AdminNotFoundException(id);
        if (u.getRole() != User.Role.ADMINISTRADOR) throw new NotAnAdminException();

        if (alias != null && !alias.isBlank()) u.setAlias(alias.trim());
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
        user.setBlocked(true);

        String token = generateToken();
        user.setAdminApprovalToken(token);
        user.setAdminApprovalExpires(LocalDateTime.now().plusDays(2));
        user.setAdminApprovalStatus(User.AdminApprovalStatus.PENDING);
        userDao.save(user);
        enviarCorreoAprobacionAdmin(user, token);
        return user;
    }

    private void enviarCorreoAprobacionAdmin(User pendingUser, String token) {
        String to = resolveSuperAdminEmailOrThrow();
        String approve = "http://localhost:8081/users/admin/admins/approve?token=" + token;
        String reject = "http://localhost:8081/users/admin/admins/reject?token=" + token;

        String alias = pendingUser.getAlias() != null ? pendingUser.getAlias() : "-";
        String nombre = pendingUser.getNombre() != null ? pendingUser.getNombre() : "";
        String apell = pendingUser.getApellidos() != null ? pendingUser.getApellidos() : "";
        String mail = pendingUser.getEmail() != null ? pendingUser.getEmail() : "-";
        String depto = pendingUser.getDepartamento() != null ? pendingUser.getDepartamento() : "-";

        String body = """
                <!DOCTYPE html>
                <html lang="es">
                <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                <title>ESIMedia – Aprobación de nuevo ADMIN</title>
                <style>
                    body,table,td,a { text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; -webkit-text-size-adjust: 100%%; }
                    table,td { border-collapse: collapse !important; }
                    img { border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
                    body { margin: 0 !important; padding: 0 !important; width: 100%% !important; background: #f5f7fb; }
                    .container { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
                    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 6px 24px rgba(16, 24, 40, 0.06); overflow: hidden; }
                    .header { background: linear-gradient(135deg, #2563EB 0%%, #1D4ED8 100%%); color: #fff; padding: 20px 24px; }
                    .header h1 { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: .2px; }
                    .content { padding: 24px; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
                    .content h2 { margin: 0 0 12px 0; font-size: 18px; color: #111827; }
                    .muted { color: #6b7280; font-size: 13px; }
                    .list { margin: 16px 0 20px 0; padding: 0; list-style: none; }
                    .list li { padding: 8px 0; border-bottom: 1px solid #eef2f7; font-size: 14px; }
                    .list b { color: #111827; }
                    .actions { padding: 8px 0 0 0; text-align: center; }
                    .btn { display: inline-block; padding: 12px 18px; margin: 8px 6px; border-radius: 8px; text-decoration: none !important; font-weight: 600; font-size: 14px; font-family: Arial, Helvetica, sans-serif; }
                    .btn-approve { background: #16a34a; color: #ffffff !important; }
                    .btn-reject  { background: #ef4444; color: #ffffff !important; }
                    .divider { height: 1px; background: #eef2f7; margin: 20px 0; }
                    .footer { padding: 12px 24px 20px 24px; text-align: center; font-family: Arial, Helvetica, sans-serif; color: #6b7280; font-size: 12px; }
                    .link { color: #2563eb !important; text-decoration: none; word-break: break-all; }
                    @media (prefers-color-scheme: dark) {
                    body { background: #0B1220; }
                    .card { background: #111827; box-shadow: none; }
                    .content { color: #e5e7eb; }
                    .content h2 { color: #f3f4f6; }
                    .list li { border-bottom-color: #1f2937; }
                    .muted, .footer { color: #9ca3af; }
                    }
                </style>
                </head>
                <body>
                <div class="container">
                    <table role="presentation" width="100%%" class="card">
                    <tr>
                        <td class="header">
                        <h1>ESIMedia · Aprobación de ADMIN</h1>
                        </td>
                    </tr>
                    <tr>
                        <td class="content">
                        <h2>Solicitud de alta de <b>ADMINISTRADOR</b></h2>
                        <p class="muted">Revisa los datos y autoriza o rechaza. El enlace expira en 48&nbsp;h.</p>
                        <ul class="list">
                            <li>Alias: <b>%s</b></li>
                            <li>Nombre: <b>%s %s</b></li>
                            <li>Email: <b>%s</b></li>
                            <li>Departamento propuesto: <b>%s</b></li>
                        </ul>
                        <div class="actions">
                            <a class="btn btn-approve" href="%s">✔ Autorizar</a>
                            <a class="btn btn-reject"  href="%s">✖ Rechazar</a>
                        </div>
                        <div class="divider"></div>
                        <p class="muted">Si los botones no funcionan, copia y pega estos enlaces en tu navegador:</p>
                        <p class="muted">
                            Autorizar: <a class="link" href="%s">%s</a><br/>
                            Rechazar:  <a class="link" href="%s">%s</a>
                        </p>
                        </td>
                    </tr>
                    <tr>
                        <td class="footer">
                        © %d ESIMedia · Este enlace puede ser previsualizado por algunos clientes de correo. Si no solicitaste esta acción, ignora este mensaje.
                        </td>
                    </tr>
                    </table>
                </div>
                </body>
                </html>
                """
                .formatted(
                        alias, nombre, apell, mail, depto,
                        approve, reject,
                        approve, approve,
                        reject, reject,
                        java.time.Year.now().getValue());

        try {
            emailService.sendMail(to, "ESIMedia – Aprobación de nuevo ADMIN", body);
        } catch (MessagingException e) {
            throw new EmailSendException("Error enviando correo de aprobación al superAdmin", e);
        }
    }

    public User aprobarAdminPorToken(String token) {
        if (token == null || token.isBlank()) throw new InvalidTokenException(TOKEN_NOT_PROVIDED);
        User u = userDao.findByAdminApprovalToken(token.trim());
        if (u == null) throw new InvalidTokenException(INVALID_TOKEN);
        if (u.getAdminApprovalStatus() != User.AdminApprovalStatus.PENDING) throw new InvalidTokenException("La solicitud no está pendiente");
        if (u.getAdminApprovalExpires() == null || u.getAdminApprovalExpires().isBefore(LocalDateTime.now())) throw new ExpiredTokenException(EXPIRED_TOKEN);

        u.setAdminApprovalStatus(User.AdminApprovalStatus.APPROVED);
        u.setAdminApprovalToken(null);
        u.setAdminApprovalExpires(null);
        u.setRole(User.Role.ADMINISTRADOR);
        u.setBlocked(false);
        return userDao.save(u);
    }

    public User rechazarAdminPorToken(String token) {
        if (token == null || token.isBlank()) throw new InvalidTokenException(TOKEN_NOT_PROVIDED);
        User u = userDao.findByAdminApprovalToken(token.trim());
        if (u == null) throw new InvalidTokenException(INVALID_TOKEN);
        if (u.getAdminApprovalStatus() != User.AdminApprovalStatus.PENDING) throw new InvalidTokenException("La solicitud no está pendiente");
        if (u.getAdminApprovalExpires() == null || u.getAdminApprovalExpires().isBefore(LocalDateTime.now())) throw new ExpiredTokenException(EXPIRED_TOKEN);

        u.setAdminApprovalStatus(User.AdminApprovalStatus.REJECTED);
        u.setAdminApprovalToken(null);
        u.setAdminApprovalExpires(null);
        u.setBlocked(true);
        return userDao.save(u);
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
