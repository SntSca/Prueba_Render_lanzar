package com.example.usersbe;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.model.User;
import com.example.usersbe.services.UserService;

@ExtendWith(MockitoExtension.class)
class HU05_TDDTest {

    @Mock UserDao userDao;
    @InjectMocks UserService userService;

    @Test
    void estandar_a_vip_poneVipSinceAhora() {
        User u = new User();
        u.setId("u1");
        u.setVip(false);
        u.setVipSince(null);

        when(userDao.findByEmail("user@example.com")).thenReturn(u);
        when(userDao.save(any())).thenAnswer(i -> i.getArgument(0));

    
        User updated = userService.updateProfile(
                "user@example.com",
                "marina", 
                "sobrino blanco", 
                "marinita", 
                "assets/avatars/avatar4.png", 
                Boolean.TRUE 
        );

        assertThat(updated.isVip()).isTrue();
        assertThat(updated.getVipSince()).isNotNull();
        assertThat(updated.getVipSince()).isBeforeOrEqualTo(LocalDateTime.now());
    }

    @Test
    void vip_a_estandar_limpiaVipSince() {
        User u = new User();
        u.setId("u1");
        u.setVip(true);
        u.setVipSince(LocalDateTime.parse("2024-01-01T00:00:00"));

        when(userDao.findByEmail("user@example.com")).thenReturn(u);
        when(userDao.save(any())).thenAnswer(i -> i.getArgument(0));

        User updated = userService.updateProfile(
                "user@example.com",
                "marina", 
                "sobrino blanco", 
                "marinita", 
                "assets/avatars/avatar4.png", 
                Boolean.FALSE 
        );

        assertThat(updated.isVip()).isFalse();
        assertThat(updated.getVipSince()).isNull();
    }
}

