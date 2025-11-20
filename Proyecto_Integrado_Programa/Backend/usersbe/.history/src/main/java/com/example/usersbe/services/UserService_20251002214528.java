package com.example.usersbe.services;


import com.example.usersbe.dao.UserDao;
import com.example.usersbe.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;


@Service
public class UserService {

    @Autowired
    private UserDao userDao;

    public void registrar(String nombre, String apellidos, String alias, String email, 
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role) throws Exception {

        if (this.userDao.findByEmail(email) != null) {
            throw new Exception("El usuario ya existe");
        }

        String pwdEncriptada = org.mindrot.jbcrypt.BCrypt.hashpw(pwd, org.mindrot.jbcrypt.BCrypt.gensalt());

        User user = new User();
        user.setNombre(nombre);
        user.setApellidos(apellidos);
        user.setAlias(alias);
        user.setEmail(email);
        user.setFechaNac(java.time.LocalDate.parse(fechaNac));
        user.setPwd(pwdEncriptada);
        user.setVip(vip);
        user.setFoto(foto);
        user.setRole(role);

        this.userDao.save(user);
    }
}

