FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
# Reproducible (respeta el lockfile) y sin dependencias de desarrollo: las pruebas no corren dentro del contenedor.
RUN npm ci --omit=dev
COPY . .
EXPOSE 5000

# El contenedor se marca "healthy" solo si el servidor responde en su puerto interno.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "start"]