import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLogin } from '../../hooks/useLogin';
import { HOME_BY_ROL } from '../../components/ProtectedRoute';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ConnectionErrorState from '../../components/ui/ConnectionErrorState';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/Button';
import { Alert, AlertDescription } from '../../components/ui/alert';

const RESTAURANT_NAME = import.meta.env.VITE_RESTAURANT_NAME || 'Mi Restaurante';

/**
 * Login único compartido por los 4 roles de staff (cocina, bebidas, caja,
 * admin). No hay selector de rol: el backend lo determina a partir del
 * usuario autenticado, y la redirección post-login lo lee de /auth/me.
 *
 * Esta pantalla también usa useAuth para no mostrarle el formulario a
 * alguien cuya cookie httpOnly ya es válida (entra a /login con sesión viva).
 *
 * Flujo:
 * 1. isLoading   → Spinner (todavía no sabemos si ya hay sesión)
 * 2. isError     → /auth/me falló de verdad (5xx, red) → ConnectionErrorState
 * 3. autenticado → redirect automático a la home de su rol (o error si el
 *                  rol no está mapeado: nunca se adivina una ruta)
 * 4. sin sesión  → formulario
 *
 * Después de un login exitoso, useLogin invalida ['auth','me'] y esta misma
 * pantalla está suscripta a esa query vía useAuth: en cuanto se refresca,
 * el componente re-renderiza como "autenticado" y dispara la redirección.
 * No hay estado duplicado del usuario en ningún lado.
 */
export default function LoginPage() {
  const { rol, isLoading, isAuthenticated, isError, refetch } = useAuth();
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" className="text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return <ConnectionErrorState onRetry={refetch} />;
  }

  if (isAuthenticated) {
    const home = HOME_BY_ROL[rol];

    if (!home) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <EmptyState
            icon="⚠️"
            title="Rol no reconocido"
            description={`Tu cuenta tiene el rol "${rol}", que no está configurado en el sistema. Contactá al administrador.`}
          />
        </div>
      );
    }

    return <Navigate to={home} replace />;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    if (login.isPending) return;
    login.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {RESTAURANT_NAME}
          </p>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Acceso exclusivo para personal del restaurante.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Correo electrónico
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={login.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Contraseña
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={login.isPending}
              />
            </div>

            {login.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {login.error?.message || 'No se pudo iniciar sesión. Intentá de nuevo.'}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
