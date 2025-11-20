package com.EsiMediaG03.services;

/**
 * Proxy para comunicarse con el backend de usuarios.
 * Clase Singleton: solo una instancia durante toda la aplicación.
 */
public class ProxyBEUsuarios {

    private static ProxyBEUsuarios instancia;
    private final String baseUrl = "http://localhost:8081/users";

    // Constructor privado para evitar instanciación externa
    private ProxyBEUsuarios() {}

    /**
     * Devuelve la instancia única del proxy (patrón Singleton).
     */
    public static synchronized ProxyBEUsuarios get() {
        if (instancia == null) {
            instancia = new ProxyBEUsuarios();
        }
        return instancia;
    }

    // Aquí podrás añadir otros métodos de comunicación HTTP más adelante
    // Ejemplo:
    // public Usuario obtenerUsuario(String userId) { ... }
    // public boolean esVip(String userId) { ... }
}
