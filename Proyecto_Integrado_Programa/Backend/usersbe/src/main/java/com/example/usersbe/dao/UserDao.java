package com.example.usersbe.dao;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import com.example.usersbe.model.User;

import java.util.List;

public interface UserDao extends MongoRepository<User, String> {

    User findByEmailAndPwd(String email, String pwd);

    User findByEmail(String email);

    User findByResetPasswordToken(String token);

    User findByAlias(String alias);
    boolean existsByAliasIgnoreCase(String alias);

    List<User> findByRole(User.Role role);
    List<User> findByRoleAndBlocked(User.Role role, boolean blocked);

    @Query(value = "{ 'role': ?0, $or: [ " +
            " { 'alias':  { $regex: ?1, $options: 'i' } }, " +
            " { 'email':  { $regex: ?1, $options: 'i' } }, " +
            " { 'nombre': { $regex: ?1, $options: 'i' } } ] }")
    List<User> searchCreators(User.Role role, String search);

    @Query(value = "{ 'role': ?0, 'blocked': ?2, $or: [ " +
            " { 'alias':  { $regex: ?1, $options: 'i' } }, " +
            " { 'email':  { $regex: ?1, $options: 'i' } }, " +
            " { 'nombre': { $regex: ?1, $options: 'i' } } ] }")
    List<User> searchCreatorsByBlocked(User.Role role, String search, boolean blocked);

    User findByAdminApprovalToken(String adminApprovalToken);

    void deleteByEmail(String email);
}
