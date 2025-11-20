package com.EsiMediaG03.services;

public class ProxyBEUsuarios {

    private static ProxyBEUsuarios instancia;
    private final String baseUrl = "http://localhost:8081/users";

    private ProxyBEUsuarios() {}
    public static synchronized ProxyBEUsuarios get() {
        if (instancia == null) {
            instancia = new ProxyBEUsuarios();
        }
        return instancia;
    }
