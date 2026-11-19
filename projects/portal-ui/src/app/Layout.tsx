import { useState } from 'react';
import { Bell, Calendar, Home, LogOut, Menu, Search, ShieldCheck, User } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.svg';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { PROJECT_LABEL, dateText, timeText, toProjectKey } from '@/features/home/shared';
import { useNotices } from '@/features/home/useNotices';

type NavItem = { to: string; label: string; testId: string; adminOnly?: boolean; icon: typeof Home; end?: boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', testId: 'nav-home', icon: Home, end: true },
  { to: '/calendario', label: 'Calendario', testId: 'nav-calendar', icon: Calendar },
  { to: '/cuenta', label: 'Mi cuenta', testId: 'nav-account', icon: User },
  { to: '/administracion', label: 'Administración', testId: 'nav-admin', adminOnly: true, icon: ShieldCheck },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const topLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
  );

const sheetLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  );

function initialsOf(name: string, email: string): string {
  const parts = (name.trim() || email).split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

interface LayoutProps {
  onOpenSearch: () => void;
}

export function Layout({ onOpenSearch }: LayoutProps) {
  const { user, isAdmin } = useSession();
  const navigate = useNavigate();
  const { data: notices, error: noticesError, refresh: refreshNotices } = useNotices();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);
  // La barra superior muestra hasta tres enlaces; «Mi cuenta» vive en el menú de usuario y en el Sheet.
  const topNav = visibleNav.filter((item) => item.testId !== 'nav-account');
  const upcoming = notices?.upcoming ?? [];
  const unread = isAdmin ? (notices?.unreadMessages ?? 0) : 0;
  const pending = upcoming.length + unread;
  const initials = initialsOf(user.name, user.email);

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch {
      // Igual cerramos la vista: la cookie se borra o la sesión ya no existe.
    }
    window.location.assign('/login');
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:gap-4 md:px-6">
        <Link
          to="/"
          aria-label="RIVECT · Inicio"
          className="flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <img src={logo} alt="RIVECT" className="h-5 w-auto" />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {topNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={topLinkClass} data-testid={item.testId}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <Button
            variant="outline"
            aria-label="Buscar"
            data-testid="search-button"
            onClick={onOpenSearch}
            className="h-11 w-11 justify-center px-0 text-muted-foreground md:h-9 md:w-60 md:justify-between md:px-3"
          >
            <span className="flex items-center gap-2">
              <Search aria-hidden="true" />
              <span className="hidden md:inline">Buscar…</span>
            </span>
            <kbd className="hidden rounded border px-1.5 font-mono text-xs leading-5 text-muted-foreground md:inline-block">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </Button>

          <Popover open={bellOpen} onOpenChange={setBellOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="notifications-button"
                aria-label={pending > 0 ? `Avisos (${pending} pendientes)` : 'Avisos'}
                className="relative"
              >
                <Bell />
                {pending > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-foreground px-1 font-mono text-xs font-semibold leading-none text-background"
                  >
                    {pending > 9 ? '9+' : pending}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">Avisos</p>
              </div>
              <div className="max-h-96 overflow-y-auto p-2">
                {noticesError && !notices && (
                  <div role="alert" className="flex items-center justify-between gap-2 p-2 text-sm">
                    <span>No se pudieron cargar los avisos.</span>
                    <Button variant="outline" size="sm" onClick={refreshNotices}>Reintentar</Button>
                  </div>
                )}
                {upcoming.slice(0, 5).map((job) => (
                  <Link
                    key={job.id}
                    to="/calendario"
                    onClick={() => setBellOpen(false)}
                    className="flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate font-medium">{job.title}</span>
                    <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                      {dateText(job.date)}
                      {timeText(job) ? ` · ${timeText(job)}` : ''} · {PROJECT_LABEL[toProjectKey(job.project)]}
                    </span>
                  </Link>
                ))}
                {unread > 0 && (
                  <Link
                    to="/administracion?tab=messages"
                    onClick={() => setBellOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{unread === 1 ? '1 mensaje sin leer' : `${unread} mensajes sin leer`}</span>
                    <span className="text-muted-foreground">Ver</span>
                  </Link>
                )}
                {pending === 0 && !noticesError && (
                  <p className="px-3 py-4 text-sm text-muted-foreground">No tenés avisos pendientes.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="user-menu"
                aria-label={`Menú de ${user.name || user.email}`}
                className="rounded-full"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{user.name || user.email}</span>
                <span className="truncate font-mono text-[12px] font-normal text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-account" onSelect={() => navigate('/cuenta')}>
                <User /> Mi cuenta
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onSelect={() => navigate('/administracion')}>
                  <ShieldCheck /> Administración
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-logout" onSelect={() => void logout()}>
                <LogOut /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú" className="md:hidden">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(320px,85vw)] flex-col gap-0 p-0">
              <SheetHeader className="border-b px-4 py-4 text-left">
                <SheetTitle className="text-base">Menú</SheetTitle>
                <SheetDescription className="sr-only">Navegación del portal</SheetDescription>
              </SheetHeader>
              <nav aria-label="Menú principal" className="flex flex-1 flex-col gap-1 p-3">
                {visibleNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={sheetLinkClass}
                    data-testid={`m-${item.testId}`}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="flex flex-col gap-3 border-t p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name || user.email}</p>
                    <p className="truncate font-mono text-[12px] text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => void logout()} className="w-full">
                  <LogOut /> Cerrar sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 py-6 outline-none md:px-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
