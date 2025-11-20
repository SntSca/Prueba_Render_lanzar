package com.EsiMediaG03.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ContenidoService {

        @Autowired
    private UserDao userDao;
    
    @Autowired
    private TokensDao tokensDao;
    
}
