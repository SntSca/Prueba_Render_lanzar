package com.example.usersbe;

import com.example.usersbe.http.UserController;
import com.example.usersbe.model.User;
import com.example.usersbe.services.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController controller;

    private MockMvc mvc;
    private final ObjectMapper om = new ObjectMapper();

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void checkAlias_and_email() throws Exception {
        when(userService.isAliasAvailable("pepito")).thenReturn(true);
        when(userService.isEmailAvailable("a@mail.com")).thenReturn(true);

        mvc.perform(get("/users/check-alias/pepito"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));

        mvc.perform(get("/users/check-email/a@mail.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    @DisplayName("registrar USUARIO ok")
    void registrar_usuario_ok() throws Exception {
        Map<String, String> body = Map.of(
                "role", "USUARIO",
                "nombre", "N",
                "apellidos", "A",
                "email", "U@MAIL.com",
                "pwd", "Aa1!aaaa",
                "pwd2", "Aa1!aaaa",
                "alias", "ali",
                "fechaNac", "2001-01-02",
                "foto", "f.png"
        );

        mvc.perform(post("/users/Registrar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(body)))
                .andExpect(status().isOk());

        ArgumentCaptor<String> nombre = ArgumentCaptor.forClass(String.class);
        verify(userService).registrar(
                nombre.capture(), anyString(), eq("ali"),
                eq("u@mail.com"), eq("2001-01-02"),
                eq("Aa1!aaaa"), anyBoolean(), eq("f.png"),
                eq(User.Role.USUARIO), isNull(), isNull(), isNull(), isNull(), isNull()
        );
        assertEquals("N", nombre.getValue());
    }

    @Test
    @DisplayName("registrar valida email y password")
    void registrar_validations() throws Exception {
        Map<String, String> badEmail = Map.of(
                "role", "USUARIO",
                "nombre", "N",
                "apellidos", "A",
                "email", "mal",
                "pwd", "Aa1!aaaa",
                "pwd2", "Aa1!aaaa",
                "alias", "ali",
                "fechaNac", "2001-01-02",
                "foto", "f.png"
        );
        mvc.perform(post("/users/Registrar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(badEmail)))
                .andExpect(status().isForbidden())
                .andExpect(status().reason(containsString("Email no válido")));

        Map<String, String> mismatchPwd = Map.of(
                "role", "USUARIO",
                "nombre", "N",
                "apellidos", "A",
                "email", "u@mail.com",
                "pwd", "Aa1!aaaa",
                "pwd2", "otra",
                "alias", "ali",
                "fechaNac", "2001-01-02",
                "foto", "f.png"
        );
        mvc.perform(post("/users/Registrar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(mismatchPwd)))
                .andExpect(status().isForbidden())
                .andExpect(status().reason(containsString("Las contraseñas no coinciden")));
    }

    @Test
void forgot_and_reset_password_ok() throws Exception {
doNothing().when(userService).sendPasswordRecoveryEmail("user@mail.com");
doNothing().when(userService).resetPassword("tok", "NewPass1!");

mvc.perform(post("/users/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("email", "user@mail.com"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").exists());

mvc.perform(post("/users/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of(
                        "token", "tok",
                        "newPassword", "NewPass1!"
                ))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Contraseña actualizada correctamente"));
}


    @Test
    void listar_y_getUser() throws Exception {
        User u = new User();
        u.setId("u1"); u.setEmail("a@mail.com");
        when(userService.listarUsuarios()).thenReturn(List.of(u));
        when(userService.getUserByEmail("a@mail.com")).thenReturn(u);

        mvc.perform(get("/users/listarUsuarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("u1"));

        mvc.perform(get("/users/obtenerPerfilUsuario").param("email", "a@mail.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("a@mail.com"));
    }

    @Test
    void updateCreador_y_updateUser_ok() throws Exception {
        User u = new User();
        u.setId("u1");
        when(userService.updateCreadorContenido(anyString(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(u);
        when(userService.updateProfile(anyString(), any(), any(), any(), any(), any()))
                .thenReturn(u);

        mvc.perform(put("/users/modificarPerfilCreadorContenido")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(Map.of(
                                "email", "c@mail.com",
                                "nombre", "N",
                                "apellidos", "A",
                                "alias", "al",
                                "descripcion", "d",
                                "especialidad", "e",
                                "tipoContenido", "VIDEO",
                                "foto", "f.png"
                        )))).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u1"));

        mvc.perform(put("/users/modificarPerfilUsuario")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(Map.of(
                                "email", "u@mail.com",
                                "nombre", "N",
                                "apellidos", "A",
                                "alias", "al",
                                "foto", "f.png",
                                "vip", true
                        )))).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u1"));
    }

    @Test
    void admin_creators_endpoints_ok() throws Exception {
        User u = new User(); u.setId("c1");
        when(userService.listarCreadores(null, null)).thenReturn(List.of(u));
        when(userService.actualizarCreador(eq("c1"), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(u);
        when(userService.bloquearCreador("c1")).thenReturn(u);
        when(userService.desbloquearCreador("c1")).thenReturn(u);
        doNothing().when(userService).eliminarCreador("c1");

        mvc.perform(get("/users/admin/creators"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("c1"));

        mvc.perform(patch("/users/admin/creators/c1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(Map.of(
                                "alias", "al", "nombre", "N", "apellidos", "A",
                                "email", "c@mail.com", "foto", "f.png",
                                "descripcion", "d", "especialidad", "e"
                        )))).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("c1"));

        mvc.perform(post("/users/admin/creators/c1/block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("c1"));

        mvc.perform(post("/users/admin/creators/c1/unblock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("c1"));

        mvc.perform(delete("/users/admin/creators/c1"))
                .andExpect(status().isNoContent());
    }

    @Test
    void admin_users_endpoints_ok() throws Exception {
        User u = new User(); u.setId("u1");
        when(userService.actualizarUsuario(eq("u1"), any(), any(), any(), any(), any(), any()))
                .thenReturn(u);
        when(userService.bloquearUsuario("u1")).thenReturn(u);
        when(userService.desbloquearUsuario("u1")).thenReturn(u);
        doThrow(new com.example.usersbe.exceptions.UserDeletionNotAllowedException("No se permite eliminar usuarios."))
                .when(userService).eliminarUsuario("u1");

        mvc.perform(patch("/users/admin/users/u1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(Map.of(
                                "alias","al","nombre","N","apellidos","A",
                                "email","u@mail.com","foto","f.png","fechaNac","2001-01-02"
                        )))).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u1"));

        mvc.perform(post("/users/admin/users/u1/block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u1"));

        mvc.perform(post("/users/admin/users/u1/unblock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u1"));

        mvc.perform(delete("/users/admin/users/u1"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void crear_admin_por_admin_ok() throws Exception {
        when(userService.solicitarCreacionAdmin(any())).thenAnswer(inv -> {
            var req = inv.getArgument(0);
            return new User();
        });
        var body = Map.of(
                "nombre","N","apellidos","A","email","admin@mail.com",
                "pwd","Aa1!aaaa","pwd2","Aa1!aaaa","foto","f.png"
        );
        mvc.perform(post("/users/admin/admins")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void crear_creador_por_admin_ok() throws Exception {
        doAnswer(inv -> null)
                .when(userService)
                .registrar(
                        anyString(), 
                        anyString(), 
                        anyString(), 
                        anyString(), 
                        anyString(), 
                        anyString(), 
                        anyBoolean(),
                        anyString(), 
                        eq(User.Role.GESTOR_CONTENIDO),
                        any(),       
                        any(),       
                        any()       
                );
        var body = Map.of(
                "nombre","N",
                "apellidos","A",
                "email","c@mail.com",
                "alias","al",
                "pwd","Aa1!aaaa",
                "pwd2","Aa1!aaaa",
                "foto","f.png",
                "descripcion","Desc",
                "especialidad","esp",
                "tipoContenido","AUDIO"
        );

        mvc.perform(post("/users/admin/creators")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(body)))
                .andExpect(status().isCreated())     
                .andExpect(jsonPath("$.status").value("ok"));

        verify(userService).registrar(
                anyString(), anyString(), anyString(), eq("c@mail.com"),
                anyString(), anyString(), anyBoolean(), anyString(),
                eq(User.Role.GESTOR_CONTENIDO), any(), any(), any()
        );
    }

}