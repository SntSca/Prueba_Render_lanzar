package com.EsiMediaG03.http;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {
    @Autowired
    ContenidoService   contenidoService;
    
}
