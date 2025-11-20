package com.example.usersbe.dto;

import java.time.Instant;

public class CreadorDTO {
  public String id;
  public String alias;
  public String nombre;
  public String email;
  public boolean blocked;
  public boolean deleted;
  public Instant createdAt;
  public String fotoUrl;
  public String bio;

  public CreadorDTO(String id, String alias, String nombre, String email,
                    boolean blocked, boolean deleted, Instant createdAt,
                    String fotoUrl, String bio) {
    this.id = id; this.alias = alias; this.nombre = nombre; this.email = email;
    this.blocked = blocked; this.deleted = deleted; this.createdAt = createdAt;
    this.fotoUrl = fotoUrl; this.bio = bio;
  }
}



