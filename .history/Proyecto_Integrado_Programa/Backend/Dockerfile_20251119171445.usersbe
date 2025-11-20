FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY --from=build /app/usersbe/target/*.jar usersbe.jar
COPY --from=build /app/EsiMediaContenidosG03/target/*.jar contenidos.jar
EXPOSE 8080
CMD ["sh", "-c", "java -jar usersbe.jar & java -jar contenidos.jar"]
