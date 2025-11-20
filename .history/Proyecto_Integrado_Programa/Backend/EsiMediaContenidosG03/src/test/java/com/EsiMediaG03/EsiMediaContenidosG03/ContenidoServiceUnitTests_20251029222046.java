package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dto.StreamingTarget;
import com.EsiMediaG03.exceptions.ContenidoException;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import com.EsiMediaG03.dao.ContenidoDAO;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;


import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pruebas integrales (controller con MockMvc) y unitarias (service con Mockito)
 * para: Streaming, control de acceso y almacenamiento de eventos (conteo).
 */


    @Nested
    @ExtendWith(MockitoExtension.class)
    class ContenidoServiceUnitTests {

        @Mock
        ContenidoDAO contenidoDAO;

        @Mock
        MongoTemplate mongoTemplate;

        @InjectMocks
        ContenidoService service;

        @Test
        void registrarReproduccion_siUsuario_incrementa_unaVez() {
            service.registrarReproduccionSiUsuario("IDX", "USUARIO");
            verify(mongoTemplate, times(1))
                    .updateFirst(any(), any(), eq(Contenido.class));
        }

        @Test
        void registrarReproduccion_noIncrementa_paraNoUsuario() {
            service.registrarReproduccionSiUsuario("IDX", "ADMIN");
            service.registrarReproduccionSiUsuario("IDX", null);
            verify(mongoTemplate, never())
                    .updateFirst(any(), any(), eq(Contenido.class));
        }

        @Test
        void validarAcceso_vipRequerido_y_usuarioNoVip_lanza() {
            Contenido c = new ContenidoBuilder()
                    .visible(true).vip(true).restringidoEdad(0)
                    .disponibleHasta(null).tipo(Contenido.Tipo.VIDEO).build();

            Assertions.assertThrows(ContenidoException.class, () ->
                    callResolveWith(c, false, 25, false));
        }

        @Test
        void validarAcceso_edadInsuficiente_lanza() {
            Contenido c = new ContenidoBuilder()
                    .visible(true).vip(false).restringidoEdad(18)
                    .disponibleHasta(null).tipo(Contenido.Tipo.VIDEO).build();

            Assertions.assertThrows(ContenidoException.class, () ->
                    callResolveWith(c, false, 15, false));
        }

        @Test
        void resolveStreamingTarget_externo_ok() throws Exception {
            Contenido c = new ContenidoBuilder()
                    .visible(true).vip(false).restringidoEdad(0)
                    .tipo(Contenido.Tipo.VIDEO).urlVideo("https://youtu.be/xyz").build();

            when(contenidoDAO.findById("IDV")).thenReturn(Optional.of(c));

            StreamingTarget t = service.resolveStreamingTarget("IDV", false, 22);
            Assertions.assertTrue(t.isExternalRedirect());
            Assertions.assertEquals("https://youtu.be/xyz", t.externalUrl());
        }

        @Test
        void resolveStreamingTarget_local_ok() throws Exception {
            File tmp = File.createTempFile("video-", ".mp4");
            try (FileOutputStream fos = new FileOutputStream(tmp)) {
                fos.write(new byte[]{0,1,2,3,4,5});
            }
            tmp.deleteOnExit();

            Contenido c = new ContenidoBuilder()
                    .visible(true).vip(false).restringidoEdad(0)
                    .tipo(Contenido.Tipo.VIDEO).urlVideo(tmp.getAbsolutePath()).build();

            when(contenidoDAO.findById("IDL")).thenReturn(Optional.of(c));

            StreamingTarget t = service.resolveStreamingTarget("IDL", false, 22);
            Assertions.assertFalse(t.isExternalRedirect());
            Assertions.assertEquals(Path.of(tmp.getAbsolutePath()), t.path());
            Assertions.assertTrue(t.length() >= 6);
            Assertions.assertTrue(t.mimeType().startsWith("video/"));
        }

        private void callResolveWith(Contenido contenido, boolean vip, Integer age, boolean shouldPass) throws Exception {
            when(contenidoDAO.findById("IDZ")).thenReturn(Optional.of(contenido));
            if (shouldPass) {
                service.resolveStreamingTarget("IDZ", vip, age);
            } else {
                service.resolveStreamingTarget("IDZ", vip, age);
            }
        }

        class ContenidoBuilder {
            private final Contenido c = new Contenido();
            ContenidoBuilder visible(boolean v) { setBoolean(c, "visible", v); return this; }
            ContenidoBuilder vip(boolean v) { setBoolean(c, "vip", v); return this; }
            ContenidoBuilder restringidoEdad(int v) { setInt(c, "restringidoEdad", v); return this; }
            ContenidoBuilder disponibleHasta(LocalDateTime dt) { setObj(c, "disponibleHasta", dt); return this; }
            ContenidoBuilder tipo(Contenido.Tipo t) { setObj(c, "tipo", t); return this; }
            ContenidoBuilder urlVideo(String u) { setObj(c, "urlVideo", u); return this; }
            Contenido build() { setObj(c, "titulo", "t"); setObj(c, "tags", java.util.List.of("x")); setInt(c, "duracionMinutos", 1); return c; }

            private void setBoolean(Object obj, String field, boolean v) { try { var f=obj.getClass().getDeclaredField(field); f.setAccessible(true); f.setBoolean(obj, v); } catch (Exception ignored) {} }
            private void setInt(Object obj, String field, int v) { try { var f=obj.getClass().getDeclaredField(field); f.setAccessible(true); f.setInt(obj, v); } catch (Exception ignored) {} }
            private void setObj(Object obj, String field, Object v) { try { var f=obj.getClass().getDeclaredField(field); f.setAccessible(true); f.set(obj, v); } catch (Exception ignored) {} }
        }
    }
