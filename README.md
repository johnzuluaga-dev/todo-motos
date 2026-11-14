# Todo Motos — Catálogo de repuestos y llantas

Catálogo web con carrito, pedido por WhatsApp y panel de administración.

> **Rama `catalogo-sin-precios`:** versión del catálogo **sin precios**. No se muestran en el catálogo, el carrito ni el mensaje de WhatsApp, y el panel no los pide. La columna `precio` de Supabase se conserva (el servidor guarda `0` al crear), así que puede usar la misma tabla que la versión con precios.

- **Catálogo público** (`/`): búsqueda por nombre, referencia o medida, orden por nombre, modo claro/oscuro, carrito y botón "Pedir por WhatsApp" con las cantidades de cada producto.
- **Panel de administración** (`/admin`): crear, editar y eliminar productos, marcar "Agotado" y subir fotos.
- **Base de datos:** Supabase (Postgres). **Imágenes:** Cloudinary. **Servidor:** Node.js + Express.

## 1. Crear la tabla en Supabase (una sola vez)

1. Abre tu proyecto `todo-motos` en [supabase.com](https://supabase.com).
2. Menú izquierdo → **SQL Editor** → **New query**.
3. Pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
4. Comprueba en **Table Editor** que aparece la tabla `productos`.

## 2. Configurar las variables (`.env`)

1. Copia `.env.example` como `.env`.
2. Llena los valores:

| Variable | De dónde sale |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API (URL del proyecto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → clave `service_role` / `secret` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary → Settings → API Keys |
| `ADMIN_PASSWORD` | La contraseña que quieras para entrar a `/admin` |
| `SESSION_SECRET` | Texto aleatorio de 32+ caracteres: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `WHATSAPP_NUMBER` | Número con código de país, solo dígitos (ej. `573001234567`) |
| `WHATSAPP_GREETING` | Saludo con el que empieza el mensaje del pedido |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` y `CLOUDINARY_API_SECRET` son secretas. No las compartas ni las subas a GitHub (`.env` ya está en `.gitignore`).

## 3. Correr en tu computador

```bash
npm install
npm run dev
```

Abre http://localhost:3000 (catálogo) y http://localhost:3000/admin (panel).

## 4. Publicar en Railway

1. Sube el proyecto a un repositorio de GitHub (sin el `.env`).
2. En [railway.app](https://railway.app): **New Project → Deploy from GitHub repo** y elige el repositorio.
3. En el servicio, pestaña **Variables**, agrega las mismas variables del `.env` y además `NODE_ENV=production`. No definas `PORT`: Railway lo pone solo.
4. En **Settings → Networking** pulsa **Generate Domain** para obtener tu URL pública.
5. Para cambiar el número de WhatsApp o el saludo después, edita las variables en Railway; se aplican al reiniciar el servicio.

Railway usa `npm start` automáticamente. El endpoint `/health` sirve como healthcheck.

## Cómo se usa el panel

- Entra a `/admin` con tu `ADMIN_PASSWORD`. No hay enlace público al panel, guarda la dirección.
- **Nuevo producto:** solo el nombre es obligatorio; referencia, medida (para llantas, ej. `90/90-17`) e imagen son opcionales.
- **Agotado:** el interruptor de cada producto lo marca al instante. Un producto agotado no se puede agregar al carrito.
- **Eliminar:** borra el producto y su imagen de Cloudinary.
- La sesión dura 8 horas y se bloquea por 15 minutos tras 5 contraseñas incorrectas.

## Estructura

```
server.js            Servidor Express (seguridad, archivos estáticos, errores)
src/                 config, auth, base de datos, Cloudinary y rutas de la API
public/              Catálogo (index.html) y panel (admin.html) con su CSS y JS
supabase/schema.sql  Tabla de productos
```
