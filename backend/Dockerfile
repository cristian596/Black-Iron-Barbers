FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./
# Reproducible (respeta el lockfile) y sin dependencias de desarrollo: las pruebas no corren dentro del contenedor.
RUN npm ci --omit=dev
COPY --chown=node:node . .
# Fotos de perfil (carpetaFotos() en utils/perfil.js): carpeta propiedad de `node` para que un volumen NUEVO montado en
# /app/uploads herede ese propietario. Un volumen que ya existía es de root: ver docs/despliegue.md (chown, una sola vez).
RUN mkdir -p /app/uploads/perfiles && chown -R node:node /app/uploads
# El proceso no corre como root (el usuario `node` de la imagen base, uid 1000).
USER node
EXPOSE 5000

# El contenedor se marca "healthy" solo si el servidor responde en su puerto interno.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "start"]
