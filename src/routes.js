const express = require('express');
const multer = require('multer');
const config = require('./config');
const auth = require('./auth');
const { supabase, TABLE, PUBLIC_COLS } = require('./db');
const { uploadImage, deleteImage } = require('./cloud');
const { HttpError } = require('./errors');

const router = express.Router();
router.use(express.json({ limit: '10kb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Formato de imagen no permitido. Usa JPG, PNG, WEBP o AVIF.'));
  },
});

// ── Validación ─────────────────────────────────
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID inválido');
  return id;
}

const isTrue = (v) => v === true || v === 'true' || v === 'on' || v === '1';

// ── Mensajes claros para el panel de admin ─────
// (solo se usan en rutas /admin, que exigen sesión: aquí sí es seguro mostrar el motivo)
function dbError(err) {
  console.error('Error de base de datos:', err);
  const msg = String(err?.message || '');
  if (err?.code === 'PGRST205' || err?.code === '42P01' || /does not exist|schema cache/i.test(msg)) {
    return new HttpError(500, 'La tabla "productos" no existe en Supabase. Ejecuta supabase/schema.sql en el SQL Editor.');
  }
  if (/invalid api key|jwt|apikey/i.test(msg)) {
    return new HttpError(500, 'Supabase rechazó la clave. Revisa que SUPABASE_SERVICE_ROLE_KEY sea la clave secreta (sb_secret_...).');
  }
  if (/fetch failed|ENOTFOUND|ECONN|ETIMEDOUT/i.test(msg)) {
    return new HttpError(500, 'No se pudo conectar con Supabase. Revisa SUPABASE_URL y tu conexión a internet.');
  }
  return new HttpError(500, `Error de base de datos: ${msg || 'desconocido'}`);
}

async function safeUpload(buffer) {
  try {
    return await uploadImage(buffer);
  } catch (err) {
    console.error('Error subiendo a Cloudinary:', err);
    const msg = String(err?.message || err?.error?.message || 'error desconocido');
    let hint = '';
    if (/cloud_name|invalid cloud/i.test(msg)) hint = ' Revisa CLOUDINARY_CLOUD_NAME.';
    else if (/api_key|signature|unauthorized|invalid/i.test(msg) || err?.http_code === 401) {
      hint = ' Revisa CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.';
    } else if (/ENOTFOUND|ECONN|ETIMEDOUT/i.test(msg)) hint = ' Revisa tu conexión a internet.';
    throw new HttpError(502, `No se pudo subir la imagen a Cloudinary: ${msg}.${hint}`);
  }
}

function parseProduct(body = {}) {
  const nombre = String(body.nombre ?? '').trim();
  const referencia = String(body.referencia ?? '').trim();
  const medida = String(body.medida ?? '').trim();
  const precio = Math.round(Number(body.precio));

  if (!nombre) throw new HttpError(400, 'El nombre es obligatorio.');
  if (nombre.length > 120) throw new HttpError(400, 'El nombre no puede pasar de 120 caracteres.');
  if (referencia.length > 60) throw new HttpError(400, 'La referencia no puede pasar de 60 caracteres.');
  if (medida.length > 60) throw new HttpError(400, 'La medida no puede pasar de 60 caracteres.');
  if (!Number.isFinite(precio) || precio < 0 || precio > 100_000_000) {
    throw new HttpError(400, 'El precio debe ser un número entre 0 y 100.000.000.');
  }

  return {
    nombre,
    referencia: referencia || null,
    medida: medida || null,
    precio,
    agotado: isTrue(body.agotado),
  };
}

// ── Público ────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    whatsappNumber: config.whatsappNumber,
    whatsappGreeting: config.whatsappGreeting,
  });
});

async function listProducts() {
  const { data, error } = await supabase
    .from(TABLE)
    .select(PUBLIC_COLS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
}

router.get(
  '/products',
  wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await listProducts());
  })
);

// ── Sesión de administrador ────────────────────
router.post('/admin/login', auth.loginLimiter, (req, res) => {
  if (!auth.checkPassword(req.body?.password)) {
    auth.registerFailure(req);
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }
  auth.clearFailures(req);
  auth.setSession(req, res);
  res.json({ ok: true });
});

router.post('/admin/logout', (req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

router.get('/admin/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ admin: auth.isAdmin(req) });
});

// Todo lo que está debajo de esta línea exige sesión de administrador.
router.use('/admin', auth.requireAdmin);

// ── CRUD de productos ──────────────────────────
router.get(
  '/admin/products',
  wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await listProducts().catch((err) => { throw dbError(err); }));
  })
);

router.post(
  '/admin/products',
  upload.single('imagen'),
  wrap(async (req, res) => {
    const data = parseProduct(req.body);
    const img = req.file ? await safeUpload(req.file.buffer) : null;

    const { data: created, error } = await supabase
      .from(TABLE)
      .insert({ ...data, imagen_url: img?.url ?? null, imagen_public_id: img?.publicId ?? null })
      .select(PUBLIC_COLS)
      .single();

    if (error) {
      if (img) await deleteImage(img.publicId);
      throw dbError(error);
    }
    res.status(201).json(created);
  })
);

router.put(
  '/admin/products/:id',
  upload.single('imagen'),
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const patch = parseProduct(req.body);

    const { data: current, error: findError } = await supabase
      .from(TABLE)
      .select('id,imagen_public_id')
      .eq('id', id)
      .maybeSingle();
    if (findError) throw dbError(findError);
    if (!current) throw new HttpError(404, 'Producto no encontrado.');

    const removeImage = isTrue(req.body.quitar_imagen);
    const img = req.file ? await safeUpload(req.file.buffer) : null;
    if (img) {
      patch.imagen_url = img.url;
      patch.imagen_public_id = img.publicId;
    } else if (removeImage) {
      patch.imagen_url = null;
      patch.imagen_public_id = null;
    }

    const { data: updated, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select(PUBLIC_COLS)
      .single();

    if (error) {
      if (img) await deleteImage(img.publicId);
      throw dbError(error);
    }
    if ((img || removeImage) && current.imagen_public_id) {
      await deleteImage(current.imagen_public_id);
    }
    res.json(updated);
  })
);

router.patch(
  '/admin/products/:id/agotado',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { data, error } = await supabase
      .from(TABLE)
      .update({ agotado: isTrue(req.body?.agotado) })
      .eq('id', id)
      .select(PUBLIC_COLS)
      .maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new HttpError(404, 'Producto no encontrado.');
    res.json(data);
  })
);

router.delete(
  '/admin/products/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .select('id,imagen_public_id')
      .maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new HttpError(404, 'Producto no encontrado.');
    await deleteImage(data.imagen_public_id);
    res.json({ ok: true });
  })
);

module.exports = router;
