const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Cliente con la service_role key: solo vive en el servidor, nunca se envía al navegador.
const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLE = 'productos';
const PUBLIC_COLS = 'id,nombre,referencia,medida,precio,imagen_url,agotado';

module.exports = { supabase, TABLE, PUBLIC_COLS };
