import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommandPalette } from '@/features/search/CommandPalette';
import { SessionProvider } from '@/lib/session';
import { AppRoutes } from './router';

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/⌘+K abre y cierra el buscador en cualquier pantalla.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <SessionProvider>
      <BrowserRouter basename="/portal">
        <TooltipProvider delayDuration={300}>
          <AppRoutes onOpenSearch={() => setSearchOpen(true)} />
          <Toaster />
          <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        </TooltipProvider>
      </BrowserRouter>
    </SessionProvider>
  );
}
