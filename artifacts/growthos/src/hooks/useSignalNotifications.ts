import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

const SIGNAL_ICONS: Record<string, string> = {
  funding: '💰',
  hiring: '👥',
  technology: '⚙️',
  news: '📰',
  intent: '🎯',
};

/**
 * Hook qui ouvre une connexion SSE et affiche un toast
 * chaque fois qu'un nouveau signal est détecté pour le tenant.
 */
export function useSignalNotifications() {
  const { isAuthenticated, accessToken } = useAuthStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // Ferme toute connexion précédente
    esRef.current?.close();

    const url = `/api/v1/notifications/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data) as {
          event?: string;
          notification?: { type?: string; title?: string; body?: string; href?: string };
        };
        const n = payload.notification;
        if (!n) return;

        const icon = SIGNAL_ICONS[n.type ?? ''] ?? '🔔';
        toast(`${icon} ${n.title ?? 'Nouvelle notification'}`, {
          description: n.body,
          action: n.href ? { label: 'Voir', onClick: () => window.location.href = n.href! } : undefined,
          duration: 6000,
        });
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // reconnecte automatiquement — EventSource gère le retry nativement
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [isAuthenticated, accessToken]);
}
