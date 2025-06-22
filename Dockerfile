# Usar uma imagem base oficial do Node.js
FROM node:18-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /app

# Copiar os arquivos de dependências
COPY package*.json ./

# Instalar as dependências do projeto

RUN npm install

# Copiar o restante dos arquivos da aplicação para o diretório de trabalho
COPY . .

# Expor a porta que a aplicação vai rodar
EXPOSE 3000

# O comando para iniciar a aplicação quando o container for executado
CMD [ "node", "server.js" ]
