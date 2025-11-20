package com.EsiMediaG03.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.EsiMediaG03.dao.ContenidoDAO;

@Service
public class ContenidoService {
        
    @Autowired
    private ContenidoDAO contenidoDAO;
    

    
}
