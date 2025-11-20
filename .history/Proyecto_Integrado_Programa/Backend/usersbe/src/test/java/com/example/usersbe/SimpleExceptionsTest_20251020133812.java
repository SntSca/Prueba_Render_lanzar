package com.example.usersbe;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SimpleExceptionsTest {

    @Test
    void blockedUserException_has_default_message() {
        BlockedUserException ex = new BlockedUserException();
        assertTrue(ex.getMessage() != null && !ex.getMessage().isBlank());
    }

    @Test
    void aliasAlreadyUsedException_has_default_message() {
        AliasAlreadyUsedException ex = new AliasAlreadyUsedException();
        assertTrue(ex.getMessage() != null && !ex.getMessage().isBlank());
    }
}