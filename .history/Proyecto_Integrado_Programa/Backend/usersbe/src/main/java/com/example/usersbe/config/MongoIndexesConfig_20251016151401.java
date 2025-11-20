package com.example.usersbe.config;

import com.example.usersbe.model.User;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

@Configuration
public class MongoIndexesConfig {

    @Bean
    public ApplicationRunner ensureIndexes(MongoTemplate template) {
        return args -> {
            template.indexOps(User.class)
                    .ensureIndex(new Index().on("email", Sort.Direction.ASC).unique());
        };
    }
}
