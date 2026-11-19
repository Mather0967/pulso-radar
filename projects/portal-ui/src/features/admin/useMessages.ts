import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMessages, markMessagesRead, sendMessage } from './adminApi';
import { markMessagesRead as markLocal, unreadCount } from './helpers';
import { messageOf, type LoadStatus } from './useUsers';
import type { AdminMessage, AdminRecipient } from './types';

const REFRESH_MS = 30_000;

/**
 * Bandeja entre administradores. Se refresca cada 30 s y al volver a la pestaña,
 * solo mientras la pestaña del navegador esté visible (igual que el legacy).
 */
export function useMessages(enabled: boolean) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [admins, setAdmins] = useState<AdminRecipient[]>([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const hasData = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (quiet = false) => {
    try {
      const data = await fetchMessages();
      if (!mounted.current) return;
      hasData.current = true;
      setMessages(data.messages);
      setAdmins(data.admins);
      setUnread(data.unread);
      setStatus('ready');
      setError('');
    } catch (e) {
      if (!mounted.current) return;
      // Un refresco silencioso no pisa una lista que ya se ve bien.
      if (!quiet || !hasData.current) {
        setError(messageOf(e));
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, load]);

  const send = useCallback(async (to: string, body: string): Promise<AdminMessage> => {
    const { message } = await sendMessage({ to, body });
    if (mounted.current) {
      setMessages((list) => [message, ...list]);
    }
    return message;
  }, []);

  const markRead = useCallback(
    async (ids: string[] | null) => {
      await markMessagesRead(ids);
      if (!mounted.current) return;
      const next = markLocal(messages, ids);
      setMessages(next);
      setUnread(unreadCount(next));
    },
    [messages],
  );

  return { messages, admins, unread, status, error, reload: load, send, markRead };
}
