const cloudinary = require('cloudinary').v2;
const config = require('./config');

cloudinary.config({ ...config.cloudinary, secure: true });

const FOLDER = 'todo-motos';

/** Sube una imagen (Buffer) a Cloudinary y devuelve { url, publicId }. */
function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/** Borra una imagen de Cloudinary. Nunca lanza error: si falla, solo lo registra. */
async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (err) {
    console.error('No se pudo borrar la imagen de Cloudinary:', publicId, err.message);
  }
}

module.exports = { uploadImage, deleteImage };
