package com.EsiMediaG03.dto;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class ModificarContenidoRequest {
    public String titulo;
    public String descripcion;
    public List<String> tags;
    public Integer duracionMinutos;
    public String resolucion;
    public Boolean vip;
    public Boolean visible;
    public LocalDateTime disponibleHasta;
    public LocalDate disponibilidadContenido;
    public Integer restringidoEdad;
    public String ficheroAudio;
    public String urlAudio;
    public String urlVideo;
    public String imagen;

}
