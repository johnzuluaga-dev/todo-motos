require('dotenv').config();

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
];

const missing = REQUIRED.filter((key) => !String(process.env[key] || '').trim());
if (missing.length) {
  console.error('\n❌ Faltan variables de entorno:\n  - ' + missing.join('\n  - '));
  console.error('\nCopia .env.example como .env y llénalo (en Railway: pestaña Variables).\n');
  process.exit(1);
}

if (process.env.SESSION_SECRET.length < 32) {
  console.error('\n❌ SESSION_SECRET debe tener al menos 32 caracteres.\n');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',
  supabaseUrl: process.env.SUPABASE_URL.trim(),
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
  },
  adminPassword: process.env.ADMIN_PASSWORD,
  sessionSecret: process.env.SESSION_SECRET,
  whatsappNumber: String(process.env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  whatsappGreeting:
    process.env.WHATSAPP_GREETING || 'Hola Importadora Todo Motos 👋, quiero hacer el siguiente pedido:',
};
