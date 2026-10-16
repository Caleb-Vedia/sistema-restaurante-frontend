/**
 * Módulo de comunicación con la API REST (NestJS).
 *
 * Toda llamada al backend pasa por aquí.
 * Centralizar esto permite:
 *   - Cambiar la URL base en un solo lugar
 *   - Agregar headers globales (ej: token de autenticación) cuando sea necesario
 *   - Pasar headers puntuales por request (ver `options` en `api.post`)
 *   - Manejar errores de manera uniforme
 *
 * NestJS devuelve errores con el formato: { statusCode, message, error }
 * donde `message` puede ser un string o un array de strings (errores de
 * validación de class-validator). Esta función captura ambos casos y
 * lanza un Error con ese mensaje.
 */
 
const BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  : '/api';
 
async function request(endpoint, options = {}) {
  // Subida de archivos (imagen de producto): el body ya viaja como FormData
  // armado por quien llama. En ese caso NO se fija Content-Type a mano —
  // el navegador tiene que generar el header con el boundary multipart
  // correcto; fijarlo nosotros mismos lo rompería.
  const isFormData = options.body instanceof FormData;

  const config = {
    // La auth de staff usa cookie httpOnly (access_token, SameSite=Strict).
    // El frontend nunca lee ni guarda el token: solo necesita que la cookie
    // viaje en cada request. Aplica a get/post/put/patch/delete.
    credentials: 'include',
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  };
 
  const response = await fetch(`${BASE_URL}${endpoint}`, config);
 
  // 204 No Content: respuesta válida sin cuerpo
  if (response.status === 204) return null;
 
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message;
    const error = new Error(message || `Error HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}
 
// FormData viaja tal cual (fetch sabe serializarlo); cualquier otro body se
// sigue mandando como JSON, exactamente igual que antes.
const serializeBody = (body) => (body instanceof FormData ? body : JSON.stringify(body));

export const api = {
  // Mismo ajuste y mismo motivo que en `post`/`patch`: GET /pedidos/:id
  // (Cliente, tracking de OrderStatusPage) necesita un X-Table-Token
  // puntual que no corresponde poner global. `options` es opcional para no
  // romper ningún `api.get(endpoint)` existente que lo llama sin segundo
  // argumento.
  get:    (endpoint, options) => request(endpoint, options),
  // Tercer parámetro `options`: opciones por request (hoy solo `headers`), para
  // los endpoints que necesitan un header propio que NO corresponde poner
  // global — el caso real es POST /pedidos con X-Table-Token, que solo vale
  // para el módulo cliente y no debe viajar en el resto de las llamadas. El
  // merge en sí ya era genérico (`...options.headers` en request); lo único
  // que faltaba era que el verbo dejara pasar el argumento. Se agrega solo en
  // `post` porque es el único que hoy lo necesita; `method` y `body` se fijan
  // DESPUÉS del spread para que options no pueda pisarlos por accidente.
  post:   (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body: serializeBody(body) }),
  put:    (endpoint, body)  => request(endpoint, { method: 'PUT',    body: serializeBody(body) }),
  // Mismo ajuste y mismo motivo que en `post`: PATCH /mesas/pedir-cuenta
  // (Cliente) necesita un X-Table-Token puntual que no corresponde poner
  // global. `body` es opcional a propósito — ese endpoint no lleva body;
  // `serializeBody(undefined)` es `undefined` (JSON.stringify(undefined)),
  // que fetch interpreta como "sin cuerpo", igual que ya pasa hoy con
  // `api.patch('/mesas/:id/cerrar-sesion')` en useReleaseTable.
  patch:  (endpoint, body, options) => request(endpoint, { ...options, method: 'PATCH', body: serializeBody(body) }),
  delete: (endpoint)        => request(endpoint, { method: 'DELETE' }),
};

/**
 * Resuelve `urlImagen` de un producto a una URL que el navegador pueda
 * cargar.
 *
 * El backend devuelve rutas internas relativas a sí mismo
 * ("/uploads/productos/x.jpg") — no son válidas tal cual en el frontend:
 * el navegador las resolvería contra SU PROPIO origen (ej. localhost:5173),
 * no el del backend. Las URLs externas históricas (http/https absolutas)
 * se devuelven intactas, sin tocar.
 *
 * El origen se deriva de BASE_URL (la misma base que usa el resto de este
 * archivo) con la API `URL`, quedándose solo con protocolo+host+puerto —
 * así, si BASE_URL alguna vez incluyera un path (ej. ".../api"), ese path
 * nunca se antepone por error a /uploads.
 */
export const resolveAssetUrl = (urlImagen) => {
  if (!urlImagen) return null;
  if (/^https?:\/\//i.test(urlImagen)) return urlImagen;
  return `${new URL(BASE_URL, window.location.origin).origin}${urlImagen}`;
};
 