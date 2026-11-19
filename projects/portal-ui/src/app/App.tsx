import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AmbientBackground } from './AmbientBackground';
import { CommandPalette } from '@/features/search/CommandPalette';
import { SessionProvider } from '@/lib/session';
import { AppRoutes } from './router';

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchOpen;
  // Elemento que tenía el foco antes de abrir el buscador; al cerrar, vuelve ahí.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const setSearch = useCallback((next: boolean) => {
    if (next) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSearchOpen(true);
      return;
    }
    setSearchOpen(false);
    // Después de que Radix termine de cerrar el diálogo (su propio foco ya se aplicó).
    requestAnimationFrame(() => {
      const previous = returnFocusRef.current;
      const target =
        previous && previous.isConnected
          ? previous
          : document.querySelector<HTMLElement>('[data-testid="search-button"]');
      target?.focus();
      returnFocusRef.current = null;
    });
  }, []);

  // Ctrl/⌘+K abre y cierra el buscador en cualquier pantalla.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearch(!searchOpenRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSearch]);

  return (
    <SessionProvider>
      <AmbientBackground />
      <BrowserRouter basename="/portal">
        <TooltipProvider delayDuration={300}>
          <AppRoutes onOpenSearch={() => setSearch(true)} />
          <Toaster />
          <CommandPalette open={searchOpen} onOpenChange={setSearch} />
        </TooltipProvider>
      </BrowserRouter>
    </SessionProvider>
  );
}
