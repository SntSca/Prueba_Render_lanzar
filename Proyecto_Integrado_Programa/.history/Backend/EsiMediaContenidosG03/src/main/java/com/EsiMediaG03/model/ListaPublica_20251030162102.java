package com.EsiMediaG03.model;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "listas")
public class ListaPublica {

    @Id
    private String id;
    private String nombre;
    private String descripcion;
    private String userEmail;
    private boolean publica = true;  // por defecto pública
    private LocalDateTime fechaCreacion = LocalDateTime.now();
    private List<String> contenidosIds; // IDs de Contenido

    public ListaPublica() {}

    public ListaPublica(String nombre, String descripcion, String userEmail, List<String> contenidosIds) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.userEmail = userEmail;
        this.contenidosIds = contenidosIds;
        this.fechaCreacion = LocalDateTime.now();
        this.publica = true;
    }

    public String getId() {
        return id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public boolean isPublica() {
        return publica;
    }

    public void setPublica(boolean publica) {
        this.publica = publica;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public List<String> getContenidosIds() {
        return contenidosIds;
    }

    public void setContenidosIds(List<String> contenidosIds) {
        this.contenidosIds = contenidosIds;
    }
}
