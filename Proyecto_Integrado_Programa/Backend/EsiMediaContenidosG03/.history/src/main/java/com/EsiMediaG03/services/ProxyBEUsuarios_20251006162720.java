package com.EsiMediaG03.services;

import java.io.IOException;

import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;

public class ProxyBEUsuarios {
    private static ProxyBEUsuarios yo;
    private String urlUsuarios = "http://localhost:8081/users/";

    // Constructor privado
    private ProxyBEUsuarios() {
    }



    public static ProxyBEUsuarios get() {
        if(yo == null) {
            yo = new ProxyBEUsuarios();
        }
        return yo;
    }

}
