const path = require('path');
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const config = require('./src/config');
const routes = require('./src/routes');
const { HttpError } = require('./src/errors');

const app = express();
app.set('trust proxy', 1); // Railway está detrás de un proxy HTTPS
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
  })
);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));

const publicDir = path.join(__dirname, 'public');

app.get('/admin', (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// El código de la página (html, js, css) se revalida en cada visita: así los cambios se ven apenas
// se despliegan (si no cambió, el navegador recibe un "304" muy liviano). Las imágenes sí se guardan 1 día.
app.use(
  express.static(publicDir, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (/\.(html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
      else res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

// ── Manejo de errores ──────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE' ? 'La imagen pesa más de 8 MB.' : 'No se pudo procesar la imagen.';
    return res.status(400).json({ error: msg });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Solicitud inválida.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Todo Motos escuchando en http://localhost:${config.port}`);
});
