import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import HomePage from '@/features/home/HomePage';
import { useSession } from '@/lib/session';
import { Layout } from './Layout';
import { NotFound } from './NotFound';

// Calendario, Mi cuenta y Administración se cargan al entrar a la ruta (presupuesto de JS inicial).
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const AccountPage = lazy(() => import('@/features/account/AccountPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));

function PageFallback() {
  return (
    <div role="status" aria-label="Cargando página" aria-busy="true" className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <Skeleton className="h-9 w-56 rounded-md" />
      <Skeleton className="h-[168px] w-full rounded-lg" />
      <Skeleton className="h-[168px] w-full rounded-lg" />
    </div>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useSession();
  useEffect(() => {
    // Se difiere: el Toaster se monta después de esta guarda y la redirección la desmonta enseguida,
    // así que un aviso inmediato se perdía. El id evita duplicados (StrictMode).
    if (!isAdmin) setTimeout(() => toast.error('Solo para administradores.', { id: 'solo-admin' }), 200);
  }, [isAdmin]);
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

interface AppRoutesProps {
  onOpenSearch: () => void;
}

export function AppRoutes({ onOpenSearch }: AppRoutesProps) {
  return (
    <Routes>
      <Route element={<Layout onOpenSearch={onOpenSearch} />}>
        <Route index element={<HomePage />} />
        <Route path="calendario" element={<Lazy><CalendarPage /></Lazy>} />
        <Route path="cuenta" element={<Lazy><AccountPage /></Lazy>} />
        <Route
          path="administracion"
          element={
            <RequireAdmin>
              <Lazy><AdminPage /></Lazy>
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
