# Usa uma imagem leve do Node (Alpine Linux)
FROM node:18-alpine

# 1. Instala o Nginx dentro do Linux
RUN apk add --no-cache nginx

# 2. Configura o Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .

# 3. Configura o Frontend (Move os arquivos HTML para a pasta do Nginx)
COPY src/ /usr/share/nginx/html

# 4. Configura o Nginx (CRÍTICO: Aqui definimos as rotas /api e /auth manualmente)
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index login.html; \
    client_max_body_size 50M; \
    \
    location /auth { \
        proxy_pass http://127.0.0.1:3000/auth; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
    } \
    \
    location /api { \
        proxy_pass http://127.0.0.1:3000/api; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
    } \
    \
    location / { \
        try_files $uri $uri/ /login.html; \
    } \
    \
    location ~* \.(css|js|png|jpg|jpeg|gif|ico)$ { \
        expires 1y; \
        add_header Cache-Control "public, no-transform"; \
    } \
}' > /etc/nginx/http.d/default.conf

# 5. Copia o script de inicialização
WORKDIR /
COPY start.sh /start.sh
RUN chmod +x /start.sh

# 6. Expõe a porta 80 (Web)
EXPOSE 80

# 7. Roda o script que liga tudo
CMD ["/start.sh"]