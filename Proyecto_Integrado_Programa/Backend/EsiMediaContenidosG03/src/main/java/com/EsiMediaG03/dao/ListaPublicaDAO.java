package com.EsiMediaG03.dao;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import com.EsiMediaG03.model.ListaPublica;

@Repository
public interface ListaPublicaDAO extends MongoRepository<ListaPublica, String> {


    List<ListaPublica> findByPublicaTrue();
    List<ListaPublica> findByContenidosIds(String contenidoId);
    List<ListaPublica> findByUserEmail(String userEmail);
}
