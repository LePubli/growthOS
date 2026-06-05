import apiClient from '@/lib/api-client';

type Properties = Record<string, unknown>;

let _queue: Array<{ event: string; properties: Properties }> = [];
let _flushing = false;

async function _flush() {
  if (_flushing || _queue.length === 0) return;
  _flushing = true;
  const batch = _queue.splice(0);
  try {
    for (const item of batch) {
      await apiClient.post('/analytics/track', item).catch(() => undefined);
    }
  } finally {
    _flushing = false;
  }
}

/**
 * Track a frontend analytics event. Fire-and-forget.
 * Events are batched and sent to /api/v1/analytics/track
 */
export function track(event: string, properties: Properties = {}): void {
  _queue.push({ event, properties });
  if (typeof window !== 'undefined') {
    setTimeout(_flush, 300);
  }
}

/** Track a page view */
export function trackPage(page: string): void {
  track('page_view', { page, url: typeof window !== 'undefined' ? window.location.href : '' });
}

/** Track a feature interaction */
export function trackFeature(feature: string, action: string, meta?: Properties): void {
  track(`feature.${action}`, { feature, ...meta });
}

export default { track, trackPage, trackFeature };
