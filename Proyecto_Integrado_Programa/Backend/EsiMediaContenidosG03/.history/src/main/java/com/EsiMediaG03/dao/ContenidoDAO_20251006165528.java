package com.EsiMediaG03.dao;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.EsiMediaG03.model.Contenido;

public interface ContenidoDAO extends MongoRepository<Contenido, String> {

    Contenido findById(String id);

    Contenido save(Contenido contenido) 

    Contenido delete(Contenido contenido);

    
}
