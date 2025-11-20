package com.example.usersbe.dto;

import com.example.usersbe.model.User;
import java.time.LocalDate;

public class RegisterRequest {

  private String nombre;
  private String apellidos;
  private String alias;
  private String email;       
  private LocalDate fechaNac;
  private String pwd;         
  private boolean vip;
  private String foto;
  private User.Role role;

  public String getNombre() { return nombre; }
  public void setNombre(String nombre) { this.nombre = nombre; }

  public String getApellidos() { return apellidos; }
  public void setApellidos(String apellidos) { this.apellidos = apellidos; }

  public String getAlias() { return alias; }
  public void setAlias(String alias) { this.alias = alias; }

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }

  public LocalDate getFechaNac() { return fechaNac; }
  public void setFechaNac(LocalDate fechaNac) { this.fechaNac = fechaNac; }

  public String getPwd() { return pwd; }
  public void setPwd(String pwd) { this.pwd = pwd; }

  public boolean isVip() { return vip; }
  public void setVip(boolean vip) { this.vip = vip; }

  public String getFoto() { return foto; }
  public void setFoto(String foto) { this.foto = foto; }

  public User.Role getRole() { return role; }
  public void setRole(User.Role role) { this.role = role; }
}
