import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export interface AppNotification {
  id: string;
  type: 'signal' | 'deal' | 'email' | 'team' | 'system';
  title: string;
  body: string;
  href?: string;
  read: boolean;
  at: string;
  createdAt?: string;
}

export function useNotifications() {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const esRef = useRef<EventSource | null>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await apiClient.get('/notifications');
      const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
      setNotifs(list);
    } catch {
      // keep current state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  useEffect(() => {
    const token = (() => {
      try {
        const raw = localStorage.getItem('growthos-auth');
        if (!raw) return null;
        return JSON.parse(raw)?.state?.accessToken ?? null;
      } catch { return null; }
    })();

    if (!token) return;

    const url = `/api/v1/notifications/stream`;
    const es = new EventSource(url + `?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { event: string; notification: AppNotification };
        if (msg.event !== 'notification') return;
        const notif = msg.notification;
        setNotifs(prev => [notif, ...prev.slice(0, 49)]);
        toast(notif.title, {
          description: notif.body,
          duration: 5000,
        });
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await apiClient.patch(`/notifications/${id}/read`, {}); } catch { /* optimistic */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try { await apiClient.post('/notifications/mark-all-read', {}); } catch { /* optimistic */ }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    try { await apiClient.delete(`/notifications/${id}`); } catch { /* optimistic */ }
  }, []);

  return { notifs, loading, markRead, markAllRead, dismiss };
}
