package edu.uclm.esi.circuits.services;

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

    public void checkCredit(String userId) throws Exception {
    // Construir correctamente la URL con el userId en la ruta
    String requestUrl = this.urlUsuarios.endsWith("/") ? 
        this.urlUsuarios + "getTransaction/" + userId : 
        this.urlUsuarios + "/getTransaction/" + userId;


    HttpGet httpGet = new HttpGet(requestUrl);
    try (CloseableHttpClient httpclient = HttpClients.createDefault()) {
        try (CloseableHttpResponse response = httpclient.execute(httpGet)) {
            int code = response.getCode();
            if (code != 200) {
                throw new Exception("El Servicio solicitado requiere pago");
            }
        }
    } catch (IOException e) {
        throw new Exception("Error al conectar con el servicio de usuarios", e);
    }
}



    public static ProxyBEUsuarios get() {
        if(yo == null) {
            yo = new ProxyBEUsuarios();
        }
        return yo;
    }

}
