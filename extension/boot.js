/* Fondo liviano para el primer pintado; el estado real sigue en auroraState. */
const BOOT_PREVIEW_KEY = 'auroraBootPreview';

try {
  const cached = JSON.parse(localStorage.getItem(BOOT_PREVIEW_KEY) || 'null');
  const preview = cached?.preview;
  const validData = typeof preview === 'string' && preview.length <= 300000 &&
    /^data:image\/(?:jpeg|webp);base64,[a-z0-9+/=]+$/i.test(preview);
  const validUrl = typeof preview === 'string' && preview.length <= 2048 &&
    /^https?:\/\//i.test(preview) && ['http:', 'https:'].includes(new URL(preview).protocol);
  if (typeof cached?.signature === 'string' && (validData || validUrl)) {
    document.getElementById('boot-preview').style.backgroundImage = `url(${JSON.stringify(preview)})`;
  }
} catch (error) { /* Sin caché o almacenamiento deshabilitado. */ }
