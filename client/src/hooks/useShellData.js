import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { cachedGet } from '../utils/idbCache';

const SHELL_CACHE_KEY = 'shell:v1';
const SHELL_CACHE_TTL_MS = 300_000;

export function useShellData() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let paintedFromCache = false;

    const applyPayload = (payload) => {
      if (cancelled || !payload) return;
      setSettings(payload.settings);
      setMenu(payload.menu || []);
    };

    cachedGet(
      SHELL_CACHE_KEY,
      async () => {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        return { settings: settingsRes.data, menu: menuRes.data.menu || [] };
      },
      {
        ttlMs: SHELL_CACHE_TTL_MS,
        onCache: (payload) => {
          paintedFromCache = true;
          applyPayload(payload);
          setLoading(false);
        },
        onFresh: applyPayload,
      },
    )
      .then((payload) => {
        if (cancelled) return;
        applyPayload(payload);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || paintedFromCache) return;
        setError(err.response?.data?.message || 'Failed to load page data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { settings, menu, loading, error, reload };
}
