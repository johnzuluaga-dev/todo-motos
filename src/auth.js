const crypto = require('crypto');
const config = require('./config');

const COOKIE = 'tm_admin';
const SESSION_MS = 1000 * 60 * 60 * 8; // 8 horas

const sign = (value) =>
  crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');

// Comparación en tiempo constante (evita ataques de temporización).
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function createToken() {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(exp)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

const isAdmin = (req) => verifyToken(parseCookies(req.headers.cookie)[COOKIE]);

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({ error: 'Sesión expirada. Inicia sesión de nuevo.' });
}

const checkPassword = (password) => safeEqual(password ?? '', config.adminPassword);

function setSession(req, res) {
  res.cookie(COOKIE, createToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    maxAge: SESSION_MS,
    path: '/',
  });
}

const clearSession = (res) => res.clearCookie(COOKIE, { path: '/' });

// ── Límite de intentos de login: 5 fallos cada 15 minutos por IP ──
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map();

function loginLimiter(req, res, next) {
  const entry = fails.get(req.ip);
  if (entry && entry.reset > Date.now() && entry.count >= MAX_FAILS) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }
  next();
}

function registerFailure(req) {
  const now = Date.now();
  const entry = fails.get(req.ip);
  if (!entry || entry.reset <= now) fails.set(req.ip, { count: 1, reset: now + WINDOW_MS });
  else entry.count += 1;
}

const clearFailures = (req) => fails.delete(req.ip);

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of fails) if (entry.reset <= now) fails.delete(ip);
}, WINDOW_MS).unref();

module.exports = {
  isAdmin,
  requireAdmin,
  checkPassword,
  setSession,
  clearSession,
  loginLimiter,
  registerFailure,
  clearFailures,
};
