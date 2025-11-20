package com.EsiMediaG03.dao;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.EsiMediaG03.model.Contenido;

import java.util.List;

public interface ContenidoDAO extends MongoRepository<Contenido, String> {

    Contenido findByTitulo(String titulo);

    List<Contenido> findByVisibleTrue();

    List<Contenido> findByTagsIn(List<String> tags);

    List<Contenido> findByTipo(Contenido.Tipo tipo);
}
