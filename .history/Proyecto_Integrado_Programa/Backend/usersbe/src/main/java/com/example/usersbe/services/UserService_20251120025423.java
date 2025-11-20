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
    
    @Value("${app.frontend.reset-password-url-base:http://localhost:4200/auth/reset-password}")
    private String resetPasswordUrlBase;

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
                          String descripcion, String especialidad, User.TipoContenido tipoContenido,
                          String departamento,
                          String mfaPreferred) {

        final String emailN = normalizeEmail(email);

        User user = buildUser(
                nombre, apellidos, alias, emailN, fechaNac, pwd, vip, foto, role,
                descripcion, especialidad, tipoContenido, departamento
        );

        applyMfaPreference(user, mfaPreferred);

        userDao.save(user);
    }

    public void registrar(String nombre, String apellidos, String alias, String email,
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role,
                          String descripcion, String especialidad, User.TipoContenido tipoContenido,
                          String departamento) {
        registrar(nombre, apellidos, alias, email, fechaNac, pwd, vip, foto, role,
                  descripcion, especialidad, tipoContenido, departamento, null);
    }

    public void registrar(String nombre, String apellidos, String alias, String email,
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role,
                          String descripcion, String especialidad, User.TipoContenido tipoContenido) {
        registrar(nombre, apellidos, alias, email, fechaNac, pwd, vip, foto, role,
                  descripcion, especialidad, tipoContenido, null, null);
    }

    public boolean isEmailAvailable(String emailNormalizado) {
        if (emailNormalizado == null || emailNormalizado.trim().isEmpty()) return false;
        String email = emailNormalizado.trim().toLowerCase();
        return userDao.findByEmail(email) == null;
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

        // ✅ Ahora: configurable por properties
        String base = resetPasswordUrlBase;
        if (base == null || base.isBlank()) {
            base = "http://localhost:4200/auth/reset-password"; 
        }
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String link = base + "?token=" + token;

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
                <html lang="es">
                    <head>
                        <meta charset="UTF-8">
                        <title>Recuperación de contraseña - EsiMedia</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Arial, sans-serif;
                                background-color: #f0f2f5;
                                color: #2c2c2c;
                                padding: 40px 0;
                                margin: 0;
                            }
                            .container {
                                max-width: 600px;
                                margin: 0 auto;
                                background-color: #ffffff;
                                border-radius: 12px;
                                padding: 40px 30px;
                                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
                                text-align: center;
                            }
                            h1 {
                                font-size: 24px;
                                color: #1a1a1a;
                                margin-bottom: 20px;
                            }
                            p {
                                font-size: 16px;
                                line-height: 1.6;
                                color: #333333;
                                margin: 10px 0;
                            }
                            .btn {
                                display: inline-block;
                                padding: 14px 32px;
                                margin-top: 25px;
                                font-size: 16px;
                                color: #ffffff;
                                text-decoration: none;
                                border-radius: 50px;
                                font-weight: 600;
                                background: linear-gradient(135deg, #007BFF, #00A2FF);
                                box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
                                transition: all 0.3s ease;
                            }
                            .btn:hover {
                                background: linear-gradient(135deg, #0066d1, #0091e6);
                                box-shadow: 0 6px 18px rgba(0, 123, 255, 0.55);
                                transform: translateY(-2px);
                            }
                            .alert {
                                color: #D32F2F;
                                font-weight: bold;
                                margin-top: 30px;
                            }
                            .footer {
                                margin-top: 40px;
                                font-size: 13px;
                                color: #666;
                                border-top: 1px solid #eee;
                                padding-top: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Recuperación de contraseña</h1>
                            <p>Hola, <strong>%s</strong>,</p>
                            <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                            <p>Haz clic en el siguiente botón para continuar:</p>
                            <a href="%s" class="btn">🔐 Restablecer contraseña</a>
                            <p>Este enlace será válido por <strong>1 hora</strong>.</p>
                            <p class="alert">⚠ Si no solicitaste este correo, puedes ignorarlo.</p>
                            <div class="footer">
                                © 2025 EsiMedia. Todos los derechos reservados.
                            </div>
                        </div>
                    </body>
                </html>
                """.formatted(nombre != null ? nombre : "usuario", link);
    }

    public void resetPassword(String token, String newPassword) {
        User user = getUserByValidToken(token);

        validateNewPassword(newPassword, user);

        String oldHash = user.getPwd();
        pushPasswordToHistory(user, oldHash);

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

    private void validateNewPassword(String newPassword, User user) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new InvalidPasswordException("La nueva contraseña debe tener al menos 8 caracteres");
        }

        if (org.mindrot.jbcrypt.BCrypt.checkpw(newPassword, user.getPwd())) {
            throw new InvalidPasswordException("La nueva contraseña no puede ser igual a la anterior");
        }
        List<String> hist = user.getPwdHistory();
        if (hist != null) {
            for (String oldHash : hist) {
                if (org.mindrot.jbcrypt.BCrypt.checkpw(newPassword, oldHash)) {
                    throw new InvalidPasswordException(
                        "La nueva contraseña ya fue utilizada recientemente (últimas 5)."
                    );
                }
            }
        }
    }
    private void pushPasswordToHistory(User user, String oldHash) {
        if (oldHash == null || oldHash.isBlank()) return;
        List<String> hist = user.getPwdHistory();
        if (hist == null) hist = new java.util.ArrayList<>();
        hist.add(0, oldHash);
        if (hist.size() > 5) {
            hist = hist.subList(0, 5);
        }
        user.setPwdHistory(hist);
        user.setPwdChangedAt(LocalDateTime.now());
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
                                  String apellidos, String email, String foto, String descripcion, String especialidad) {

        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new UserNotFoundException(CREATOR_NOT_FOUND);
        if (u.getRole() != User.Role.GESTOR_CONTENIDO) throw new InvalidRoleException(USER_NOT_A_CREATOR);

        if (alias != null && !alias.isBlank()) u.setAlias(alias.trim());
        if (nombre != null) u.setNombre(nombre.trim());
        if (apellidos != null) u.setApellidos(apellidos.trim());
        if (email != null && !email.isBlank()) u.setEmail(normalizeEmail(email));
        if (foto != null) u.setFoto(foto);
        if (descripcion != null) { u.setDescripcion(descripcion.trim()); } else { u.setDescripcion(null); }
        if (especialidad != null) u.setEspecialidad(especialidad.trim());

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

    public User actualizarAdmin(String id, String nombre,
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


    private void applyMfaPreference(User user, String mfaPreferredRaw) {
        if (user.getRole() != User.Role.USUARIO) {
            return;
        }
        String pref = (mfaPreferredRaw == null ? "" : mfaPreferredRaw.trim().toUpperCase(Locale.ROOT));
        switch (pref) {
            case "EMAIL_OTP" -> {
                user.setMfaEnabled(true);
                user.setMfaMethod(User.MfaMethod.EMAIL_OTP);
                user.setTotpSecret(null);
            }
            case "TOTP" -> {
                user.setMfaEnabled(true);
                user.setMfaMethod(User.MfaMethod.TOTP);
                user.setTotpSecret(generateTotpSecretBase32());
            }
            default -> {
                user.setMfaEnabled(false);
                user.setMfaMethod(User.MfaMethod.NONE);
                user.setTotpSecret(null);
            }
        }
    }

    private String generateTotpSecretBase32() {
        byte[] buf = new byte[20]; 
        new SecureRandom().nextBytes(buf);
        try {
            return new org.apache.commons.codec.binary.Base32().encodeToString(buf);
        } catch (NoClassDefFoundError e) {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
        }
    }
}