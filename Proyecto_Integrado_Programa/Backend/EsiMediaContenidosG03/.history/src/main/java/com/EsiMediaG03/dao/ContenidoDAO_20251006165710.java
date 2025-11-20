package com.EsiMediaG03.dao;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.EsiMediaG03.model.Contenido;

import java.util.List;

public interface ContenidoDAO extends MongoRepository<Contenido, String> {

    // Buscar contenido por título exacto
    Contenido findByTitulo(String titulo);

    // Buscar todos los contenidos visibles
    List<Contenido> findByVisibleTrue();

    // Buscar contenidos por tags (al menos uno coincidente)
    List<Contenido> findByTagsIn(List<String> tags);

    List<Contenido> findByTipo(Contenido.Tipo tipo);
}
