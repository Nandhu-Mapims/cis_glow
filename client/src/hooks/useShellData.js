import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';

const SHELL_CACHE_KEY = 'cis_shell_data_v1';
const SHELL_CACHE_TTL_MS = 300_000;

function readShellCache() {
  try {
    const raw = sessionStorage.getItem(SHELL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.settings) return null;
    return {
      settings: parsed.settings,
      menu: parsed.menu || [],
      stale: Date.now() - parsed.at > SHELL_CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeShellCache(settings, menu) {
  try {
    sessionStorage.setItem(SHELL_CACHE_KEY, JSON.stringify({
      at: Date.now(),
      settings,
      menu,
    }));
  } catch {
    // ignore quota errors
  }
}

export function useShellData() {
  const cached = readShellCache();
  const [settings, setSettings] = useState(cached?.settings ?? null);
  const [menu, setMenu] = useState(cached?.menu ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const hasCache = Boolean(readShellCache());
      if (!hasCache) setLoading(true);

      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        if (cancelled) return;
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        writeShellCache(settingsRes.data, menuRes.data.menu || []);
        setError(null);
      } catch (err) {
        if (!cancelled && !readShellCache()) {
          setError(err.response?.data?.message || 'Failed to load page data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { settings, menu, loading, error, reload };
}
