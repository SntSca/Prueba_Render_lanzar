package com.EsiMediaG03.dao;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.EsiMediaG03.model.Contenido;

public interface ContenidoDAO extends MongoRepository<Contenido, String> {

    Optional findById(String id);

    Contenido save(Contenido contenido);

    void delete(Contenido contenido);

    
}
