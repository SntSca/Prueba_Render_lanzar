package com.example.usersbe;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.dto.AdminCreationRequest;
import com.example.usersbe.exceptions.*;
import com.example.usersbe.model.User;
import com.example.usersbe.services.EmailService;
import com.example.usersbe.services.UserService;
import jakarta.mail.MessagingException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceExtraTest {

    @Mock
    private UserDao userDao;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private UserService userService;

    private User userU;
    private User userC;
    private User userA;

    @BeforeEach
    void setup() {
        userU = base("u1", "user1", "User", "Uno", "user@mail.com", User.Role.USUARIO, false);
        userC = base("c1", "crea1", "Creador", "Uno", "crea@mail.com", User.Role.GESTOR_CONTENIDO, false);
        userA = base("a1", "admin1", "Admin", "Uno", "admin@mail.com", User.Role.ADMINISTRADOR, false);
    }

    private static User base(String id, String alias, String nombre, String apellidos, String email, User.Role role, boolean blocked) {
        User u = new User();
        u.setId(id);
        u.setAlias(alias);
        u.setNombre(nombre);
        u.setApellidos(apellidos);
        u.setEmail(email);
        u.setRole(role);
        u.setBlocked(blocked);
        return u;
    }

    @Test
    @DisplayName("isAliasAvailable: true cuando no existe el alias")
    void isAliasAvailable_true() {
        when(userDao.existsByAliasIgnoreCase("nuevo")).thenReturn(false);
        assertTrue(userService.isAliasAvailable("  nuevo "));
    }

    @Test
    @DisplayName("isAliasAvailable: false si alias vacío o ya existe")
    void isAliasAvailable_false() {
        assertFalse(userService.isAliasAvailable("   "));
        when(userDao.existsByAliasIgnoreCase("dup")).thenReturn(true);
        assertFalse(userService.isAliasAvailable("dup"));
    }

    @Test
    @DisplayName("isEmailAvailable: true/false según DAO")
    void isEmailAvailable_mix() {
        when(userDao.findByEmail("new@mail.com")).thenReturn(null);
        assertTrue(userService.isEmailAvailable("  NEW@mail.com "));
        when(userDao.findByEmail("used@mail.com")).thenReturn(userU);
        assertFalse(userService.isEmailAvailable(" used@mail.com "));
    }

    @Test
    @DisplayName("sendPasswordRecoveryEmail: guarda token y envía correo si existe usuario")
    void sendPasswordRecoveryEmail_ok() throws Exception {
        when(userDao.findByEmail("user@mail.com")).thenReturn(userU);
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.sendPasswordRecoveryEmail(" User@mail.com ");

        assertNotNull(userU.getResetPasswordToken());
        assertNotNull(userU.getResetPasswordExpires());
        verify(emailService).sendMail(eq("user@mail.com"), contains("Recuperación"), anyString());
        verify(userDao).save(userU);
    }

    @Test
    @DisplayName("sendPasswordRecoveryEmail: ignora si email no existe")
    void sendPasswordRecoveryEmail_noUser() throws MessagingException {
        when(userDao.findByEmail("ghost@mail.com")).thenReturn(null);
        userService.sendPasswordRecoveryEmail("ghost@mail.com");
        verify(emailService, never()).sendMail(anyString(), anyString(), anyString());
        verify(userDao, never()).save(any());
    }

    @Test
    @DisplayName("resetPassword: ok con token válido y contraseña nueva distinta")
    void resetPassword_ok() {
        userU.setResetPasswordToken("tok");
        userU.setResetPasswordExpires(LocalDateTime.now().plusMinutes(30));
        userU.setPwd(org.mindrot.jbcrypt.BCrypt.hashpw("oldpass123", org.mindrot.jbcrypt.BCrypt.gensalt()));
        when(userDao.findByResetPasswordToken("tok")).thenReturn(userU);
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.resetPassword("tok", "newpass123");

        assertNull(userU.getResetPasswordToken());
        assertNull(userU.getResetPasswordExpires());
        assertTrue(org.mindrot.jbcrypt.BCrypt.checkpw("newpass123", userU.getPwd()));
        verify(userDao).save(userU);
    }

    @Test
    @DisplayName("resetPassword: token no provisto")
    void resetPassword_missingToken() {
        assertThrows(InvalidTokenException.class, () -> userService.resetPassword("  ", "newpass123"));
    }

    @Test
    @DisplayName("resetPassword: token inválido o sin expiración")
    void resetPassword_invalidToken() {
        when(userDao.findByResetPasswordToken("bad")).thenReturn(null);
        assertThrows(InvalidTokenException.class, () -> userService.resetPassword("bad", "newpass123"));
    }

    @Test
    @DisplayName("resetPassword: token expirado")
    void resetPassword_expired() {
        userU.setResetPasswordToken("tok");
        userU.setResetPasswordExpires(LocalDateTime.now().minusMinutes(1));
        when(userDao.findByResetPasswordToken("tok")).thenReturn(userU);
        assertThrows(ExpiredTokenException.class, () -> userService.resetPassword("tok", "newpass123"));
    }

    @Test
    @DisplayName("resetPassword: rechaza contraseña nueva < 8 o igual a la anterior")
    void resetPassword_weakOrSame() {
        userU.setResetPasswordToken("tok");
        userU.setResetPasswordExpires(LocalDateTime.now().plusMinutes(30));
        userU.setPwd(org.mindrot.jbcrypt.BCrypt.hashpw("oldpass123", org.mindrot.jbcrypt.BCrypt.gensalt()));
        when(userDao.findByResetPasswordToken("tok")).thenReturn(userU);

        assertThrows(InvalidPasswordException.class, () -> userService.resetPassword("tok", "short"));
        assertThrows(InvalidPasswordException.class, () -> userService.resetPassword("tok", "oldpass123"));
    }

    @Test
    @DisplayName("listarUsuarios: devuelve findAll")
    void listarUsuarios_ok() {
        when(userDao.findAll()).thenReturn(List.of(userU, userC, userA));
        var res = userService.listarUsuarios();
        assertEquals(3, res.size());
    }

    @Test
    @DisplayName("listarCreadores: search=null, blocked=null → findByRole")
    void listarCreadores_all() {
        when(userDao.findByRole(User.Role.GESTOR_CONTENIDO)).thenReturn(List.of(userC));
        var res = userService.listarCreadores(null, null);
        assertEquals(1, res.size());
    }

    @Test
    @DisplayName("listarCreadores: search, blocked=null → searchCreators")
    void listarCreadores_search() {
        when(userDao.searchCreators(eq(User.Role.GESTOR_CONTENIDO), eq("rock"))).thenReturn(List.of(userC));
        var res = userService.listarCreadores("  rock  ", null);
        assertEquals(1, res.size());
    }

    @Test
    @DisplayName("listarCreadores: search+blocked → searchCreatorsByBlocked")
    void listarCreadores_searchBlocked() {
        when(userDao.searchCreatorsByBlocked(eq(User.Role.GESTOR_CONTENIDO), eq("mix"), eq(true))).thenReturn(List.of(userC));
        var res = userService.listarCreadores("mix", true);
        assertEquals(1, res.size());
    }

    @Test
    @DisplayName("listarCreadores: blocked sin search → findByRoleAndBlocked")
    void listarCreadores_blockedOnly() {
        when(userDao.findByRoleAndBlocked(User.Role.GESTOR_CONTENIDO, false)).thenReturn(List.of(userC));
        var res = userService.listarCreadores(null, false);
        assertEquals(1, res.size());
    }

    @Test
    @DisplayName("getUserByEmail: ok y not found")
    void getUserByEmail_cases() {
        when(userDao.findByEmail("user@mail.com")).thenReturn(userU);
        assertEquals("u1", userService.getUserByEmail("user@mail.com").getId());
        when(userDao.findByEmail("no@mail.com")).thenReturn(null);
        assertThrows(UserNotFoundException.class, () -> userService.getUserByEmail("no@mail.com"));
    }

    @Test
    @DisplayName("actualizarCreador: ok con trims y set de campos")
    void actualizarCreador_ok() {
        userC.setDescripcion(null);
        when(userDao.findById("c1")).thenReturn(Optional.of(userC));
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var res = userService.actualizarCreador("c1", "  NuevoA ", "  N ", " A ", "  NEW@MAIL.com ", "f.png", "  desc  ", "  esp  ");
        assertEquals("NuevoA", res.getAlias());
        assertEquals("N", res.getNombre());
        assertEquals("A", res.getApellidos());
        assertEquals("new@mail.com", res.getEmail());
        assertEquals("desc", res.getDescripcion());
        assertEquals("esp", res.getEspecialidad());
    }

    @Test
    @DisplayName("actualizarCreador: not found y rol inválido")
    void actualizarCreador_errors() {
        when(userDao.findById("x")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> userService.actualizarCreador("x", null, null, null, null, null, null, null));

        when(userDao.findById("u1")).thenReturn(Optional.of(userU));
        assertThrows(InvalidRoleException.class, () -> userService.actualizarCreador("u1", null, null, null, null, null, null, null));
    }

    @Test
    @DisplayName("bloquear/desbloquear Creador: cambios e idempotencia")
    void bloquearDesbloquearCreador() {
        when(userDao.findById("c1")).thenReturn(Optional.of(userC));
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var b1 = userService.bloquearCreador("c1");
        assertTrue(b1.isBlocked());
        var b2 = userService.bloquearCreador("c1");
        assertTrue(b2.isBlocked());

        var d1 = userService.desbloquearCreador("c1");
        assertFalse(d1.isBlocked());
        var d2 = userService.desbloquearCreador("c1");
        assertFalse(d2.isBlocked());
    }

    @Test
    @DisplayName("bloquear/desbloquear/eliminar Creador: errores de not found o rol inválido")
    void creador_errors() {
        when(userDao.findById("x")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> userService.bloquearCreador("x"));
        assertThrows(UserNotFoundException.class, () -> userService.desbloquearCreador("x"));
        assertThrows(UserNotFoundException.class, () -> userService.eliminarCreador("x"));

        when(userDao.findById("u1")).thenReturn(Optional.of(userU));
        assertThrows(InvalidRoleException.class, () -> userService.bloquearCreador("u1"));
        assertThrows(InvalidRoleException.class, () -> userService.desbloquearCreador("u1"));
        assertThrows(InvalidRoleException.class, () -> userService.eliminarCreador("u1"));
    }

    @Test
    @DisplayName("eliminar Creador: ok")
    void eliminarCreador_ok() {
        when(userDao.findById("c1")).thenReturn(Optional.of(userC));
        userService.eliminarCreador("c1");
        verify(userDao).deleteById("c1");
    }

   @Test
    @DisplayName("actualizar/bloquear/desbloquear/eliminar Admin: ok + protecciones")
    void admin_ops() {
        Whitebox.setInternalState(userService, "superAdminEmail", "root@esi.com");

        when(userDao.findById("a1")).thenReturn(Optional.of(userA));
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var a = userService.actualizarAdmin("a1", " N ", " A ", " ADMIN@MAIL.com ", "f.png", " Dep ");
        assertEquals("N", a.getNombre());
        assertEquals("A", a.getApellidos());
        assertEquals("admin@mail.com", a.getEmail());
        assertEquals("Dep", a.getDepartamento());

        var b = userService.bloquearAdmin("a1");
        assertTrue(b.isBlocked());

        var d = userService.desbloquearAdmin("a1");
        assertFalse(d.isBlocked());

        userService.eliminarAdmin("a1");
        verify(userDao).deleteById("a1");
    }

    @Test
    @DisplayName("admin_ops: not found / not admin / superadmin protegido")
    void admin_ops_errors() {
        when(userDao.findById("x")).thenReturn(Optional.empty());
        assertThrows(AdminNotFoundException.class, () -> userService.actualizarAdmin("x", null, null, null, null, null));
        assertThrows(AdminNotFoundException.class, () -> userService.bloquearAdmin("x"));
        assertThrows(AdminNotFoundException.class, () -> userService.desbloquearAdmin("x"));
        assertThrows(AdminNotFoundException.class, () -> userService.eliminarAdmin("x"));

        when(userDao.findById("u1")).thenReturn(Optional.of(userU));
        assertThrows(NotAnAdminException.class, () -> userService.actualizarAdmin("u1", null, null, null, null, null));
        assertThrows(NotAnAdminException.class, () -> userService.bloquearAdmin("u1"));
        assertThrows(NotAnAdminException.class, () -> userService.desbloquearAdmin("u1"));
        assertThrows(NotAnAdminException.class, () -> userService.eliminarAdmin("u1"));

        User superAdmin = base("a2", "root", "S", "A", "root@esi.com", User.Role.ADMINISTRADOR, false);
        Whitebox.setInternalState(userService, "superAdminEmail", "root@esi.com");
        when(userDao.findById("a2")).thenReturn(Optional.of(superAdmin));
        assertThrows(SuperAdminProtectionException.class, () -> userService.bloquearAdmin("a2"));
        assertThrows(SuperAdminProtectionException.class, () -> userService.eliminarAdmin("a2"));
    }

    @Test
    @DisplayName("updateCreadorContenido: ok y bloqueado=Forbidden")
    void updateCreadorContenido_cases() {
        userC.setBlocked(false);
        when(userDao.findByEmail("crea@mail.com")).thenReturn(userC);
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var r = userService.updateCreadorContenido(
                "crea@mail.com", " N ", " A ", " alias ", " desc ", " esp ", "VIDEO", "foto.png"
        );
        assertEquals("N", r.getNombre());
        assertEquals("A", r.getApellidos());
        assertEquals("alias", r.getAlias());
        assertEquals("desc", r.getDescripcion());
        assertEquals("esp", r.getEspecialidad());
        assertEquals(User.TipoContenido.VIDEO, r.getTipoContenido());
        assertEquals("foto.png", r.getFoto());

        userC.setBlocked(true);
        when(userDao.findByEmail("crea@mail.com")).thenReturn(userC);
        assertThrows(ForbiddenException.class, () -> userService.updateCreadorContenido("crea@mail.com", null, null, null, null, null, null, null));
    }

    @Test
    @DisplayName("updateProfile: ok y bloqueado=Forbidden")
    void updateProfile_cases() {
        userU.setBlocked(false);
        when(userDao.findByEmail("user@mail.com")).thenReturn(userU);
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var r = userService.updateProfile("user@mail.com", " N ", " A ", " alias ", "f.png", true);
        assertEquals("N", r.getNombre());
        assertEquals("A", r.getApellidos());
        assertEquals("alias", r.getAlias());
        assertEquals("f.png", r.getFoto());
        assertTrue(r.isVip());

        userU.setBlocked(true);
        when(userDao.findByEmail("user@mail.com")).thenReturn(userU);
        assertThrows(ForbiddenException.class, () -> userService.updateProfile("user@mail.com", null, null, null, null, null));
    }

    @Test
    @DisplayName("darDeBajaUsuario: ok y not found")
    void darDeBajaUsuario_cases() {
        when(userDao.findByEmail("user@mail.com")).thenReturn(userU);
        userService.darDeBajaUsuario("user@mail.com");
        verify(userDao).deleteByEmail("user@mail.com");

        when(userDao.findByEmail("no@mail.com")).thenReturn(null);
        assertThrows(UserNotFoundException.class, () -> userService.darDeBajaUsuario("no@mail.com"));
    }

    @Test
    @DisplayName("registrar: GESTOR_CONTENIDO rellena campos de creador")
    void registrar_creator_buildsFields() {
        ArgumentCaptor<User> cap = ArgumentCaptor.forClass(User.class);
        when(userDao.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.registrar(
                " Nombre ", " Ap ", " alias ", " MAIL@MAIL.COM ", "2001-01-02",
                "secretPass", false, "foto.png", User.Role.GESTOR_CONTENIDO,
                " desc ", " esp ", User.TipoContenido.AUDIO, null
        );

        verify(userDao).save(cap.capture());
        User saved = cap.getValue();
        assertEquals("Nombre", saved.getNombre());
        assertEquals("Ap", saved.getApellidos());
        assertEquals("alias", saved.getAlias());
        assertEquals("mail@mail.com", saved.getEmail());
        assertEquals(LocalDate.parse("2001-01-02"), saved.getFechaNac());
        assertNotNull(saved.getPwd());
        assertEquals(User.Role.GESTOR_CONTENIDO, saved.getRole());
        assertEquals(" desc ", saved.getDescripcion());
        assertEquals(" esp ", saved.getEspecialidad());
        assertEquals(User.TipoContenido.AUDIO, saved.getTipoContenido());
    }

    @Test
    @DisplayName("sendPasswordRecoveryEmail: propaga EmailSendException si EmailService falla")
    void sendPasswordRecoveryEmail_mailError() throws Exception {
        when(userDao.findByEmail("user@mail.com")).thenReturn(userU);
        doThrow(new MessagingException("x")).when(emailService).sendMail(anyString(), anyString(), anyString());
        assertThrows(EmailSendException.class, () -> userService.sendPasswordRecoveryEmail("user@mail.com"));
    }

    static final class Whitebox {
        static void setInternalState(Object target, String field, Object value) {
            try {
                var f = target.getClass().getDeclaredField(field);
                f.setAccessible(true);
                f.set(target, value);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }
}
