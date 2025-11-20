package com.EsiMediaG03.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import com.fasterxml.jackson.annotation.JsonProperty;

@Document(collection = "contenidos")
public class Contenido {

    @Id
    private String id;
    private String userEmail;
    private String titulo;
    private String descripcion;
    private String ficheroAudio;
    private String urlAudio;
    private String urlVideo;
    private List<String> tags;
    private int duracionMinutos;
    private String resolucion;
    private boolean vip;
    private boolean visible;
    private LocalDateTime fechaEstado = LocalDateTime.now();
    private LocalDateTime disponibleHasta;
    private LocalDate disponibilidadContenido;
    private int restringidoEdad;
    private Tipo tipo;
    private String imagen;
    public enum Tipo {
        AUDIO, VIDEO
    }
    @Field("reproducciones")               
    @JsonProperty("reproducciones") 
    private long numReproducciones;
    private Set <String> favoritosDeUsuarios;
    public Set<String> getFavoritosDeUsuarios() { return favoritosDeUsuarios; }
    public void setFavoritosDeUsuarios(Set<String> favs) { this.favoritosDeUsuarios = favs; }

    private Set<String> reproductores = new HashSet<>();
    private Map<String, Double> ratings = new HashMap<>();
    private int ratingCount;
    private double ratingAvg;

    public String getId() {
        return id;
    }
    public void setId(String id) { this.id = id; }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getFicheroAudio() {
        return ficheroAudio;
    }

    public void setFicheroAudio(String ficheroAudio) {
        this.ficheroAudio = ficheroAudio;
    }

    public String getUrlAudio() {
        return urlAudio;
    }

    public void setUrlAudio(String urlAudio) {
        this.urlAudio = urlAudio;
    }

    public String getUrlVideo() {
        return urlVideo;
    }

    public void setUrlVideo(String urlVideo) {
        this.urlVideo = urlVideo;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public int getDuracionMinutos() {
        return duracionMinutos;
    }

    public void setDuracionMinutos(int duracionMinutos) {
        this.duracionMinutos = duracionMinutos;
    }

    public String getResolucion() {
        return resolucion;
    }

    public void setResolucion(String resolucion) {
        this.resolucion = resolucion;
    }

    public boolean isVip() {
        return vip;
    }

    public void setVip(boolean vip) {
        this.vip = vip;
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
        this.fechaEstado = LocalDateTime.now();
    }

    public LocalDateTime getFechaEstado() {
        return fechaEstado;
    }

    public LocalDateTime getDisponibleHasta() {
        return disponibleHasta;
    }

    public void setDisponibleHasta(LocalDateTime disponibleHasta) {
        this.disponibleHasta = disponibleHasta;
    }

    public int getRestringidoEdad() {
        return restringidoEdad;
    }

    public void setRestringidoEdad(int restringidoEdad) {
        this.restringidoEdad = restringidoEdad;
    }

    public Tipo getTipo() {
        return tipo;
    }

    public void setTipo(Tipo tipo) {
        this.tipo = tipo;
    }
    public String getImagen() {
        return imagen;
    }
    public void setImagen(String imagen) {
        this.imagen = imagen;
    }
    public String getUserEmail() {
        return userEmail;
    }
    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }
    
    public long getNumReproducciones() {
        return numReproducciones;
    }
    public void setNumReproducciones(long numReproducciones) {
        this.numReproducciones = numReproducciones;
    }

    public Set<String> getReproductores() { return reproductores; }
    public void setReproductores(Set<String> reproductores) { this.reproductores = reproductores; }

    public Map<String, Double> getRatings() { return ratings; }
    public void setRatings(Map<String, Double> ratings) { this.ratings = ratings; }

    public int getRatingCount() { return ratingCount; }
    public void setRatingCount(int ratingCount) { this.ratingCount = ratingCount; }

    public double getRatingAvg() { return ratingAvg; }
    public void setRatingAvg(double ratingAvg) { this.ratingAvg = ratingAvg; }

    public LocalDate getDisponibilidadContenido() {
        return disponibilidadContenido;
    }
    
    public void setDisponibilidadContenido(LocalDate disponibilidadContenido) {
        this.disponibilidadContenido = disponibilidadContenido;
    }
}
