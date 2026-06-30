/**
 * Módulo de comunicación con la API REST (FastAPI).
 *
 * Toda llamada al backend pasa por aquí.
 * Centralizar esto permite:
 *   - Cambiar la URL base en un solo lugar
 *   - Agregar headers globales (ej: token de autenticación) cuando sea necesario
 *   - Manejar errores de manera uniforme
 *
 * FastAPI devuelve errores con el formato: { detail: "mensaje" }
 * Esta función captura ese formato y lanza un Error con ese mensaje.
 */
 
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
 
async function request(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };
 
  const response = await fetch(`${BASE_URL}${endpoint}`, config);
 
  // 204 No Content: respuesta válida sin cuerpo
  if (response.status === 204) return null;
 
  const data = await response.json();
 
  if (!response.ok) {
    throw new Error(data.detail || `Error HTTP ${response.status}`);
  }
 
  return data;
}
 
export const api = {
  get:    (endpoint)        => request(endpoint),
  post:   (endpoint, body)  => request(endpoint, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (endpoint, body)  => request(endpoint, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (endpoint, body)  => request(endpoint, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (endpoint)        => request(endpoint, { method: 'DELETE' }),
};
 