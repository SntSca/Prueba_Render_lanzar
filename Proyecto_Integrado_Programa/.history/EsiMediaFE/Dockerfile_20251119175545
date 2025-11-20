# ===========================
# 1) Build stage
# ===========================
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar dependencias y descargarlas
COPY package.json package-lock.json ./
RUN npm install

# Copiar todo el frontend
COPY . .

# Construir proyecto
RUN npm run build


# ===========================
# 2) Production stage (Nginx)
# ===========================
FROM nginx:stable-alpine

# Copiar build generado por Vite a nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Eliminar configuración por defecto
RUN rm /etc/nginx/conf.d/default.conf

# Añadir nuestra configuración
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Render detecta el servidor en este puerto
EXPOSE 10000

CMD ["nginx", "-g", "daemon off;"]
