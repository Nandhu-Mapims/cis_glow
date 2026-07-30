import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useTransientNotice } from './useTransientNotice';
import { cachedGet, invalidateCachePrefix } from '../utils/idbCache';

function stripSaveMeta(payload = {}) {
  const { message, success, error, ...rest } = payload;
  return rest;
}

export function createSetupApi(basePath) {
  return function useModuleSetupApi(screen) {
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useTransientNotice();
    const loadSeq = useRef(0);
    const saveSeq = useRef(0);

    useEffect(() => {
      loadSeq.current += 1;
      saveSeq.current += 1;
      setData(null);
      setError(null);
      setNotice(null);
    }, [screen, setNotice]);

    const load = useCallback(async (fields = {}, query = {}) => {
      const seq = ++loadSeq.current;
      setBusy(true);
      setError(null);
      const cacheKey = `${basePath}/setup/${screen}/load:${JSON.stringify(fields)}:${JSON.stringify(query)}`;
      try {
        const result = await cachedGet(
          cacheKey,
          async () => {
            const res = await api.post(`${basePath}/setup/${screen}/load`, { fields, query });
            if (res.data.error) throw Object.assign(new Error(res.data.error), { setupError: res.data.error });
            return res.data;
          },
          {
            ttlMs: 60_000,
            onCache: (cached) => {
              if (seq === loadSeq.current) setData(cached);
            },
            onFresh: (fresh) => {
              if (seq === loadSeq.current) setData(fresh);
            },
          },
        );
        if (seq !== loadSeq.current) return null;
        setData(result);
        return result;
      } catch (err) {
        if (seq !== loadSeq.current) return null;
        setError(err.setupError || err.response?.data?.message || 'Unable to load screen');
        setData(null);
        return null;
      } finally {
        if (seq === loadSeq.current) setBusy(false);
      }
    }, [screen]);

    const save = useCallback(async (fields, files = []) => {
      const seq = ++saveSeq.current;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const res = await api.post(`${basePath}/setup/${screen}/save`, { fields, files });
        if (seq !== saveSeq.current) return null;
        if (res.data.error) {
          setError(res.data.error);
          return res.data;
        }
        if (res.data.success === false) {
          setError(res.data.message || 'Save failed');
        } else if (res.data.message) {
          setNotice(res.data.message);
        }
        setData((prev) => ({ ...(prev || {}), ...stripSaveMeta(res.data) }));
        invalidateCachePrefix(`${basePath}/setup/${screen}/load:`);
        return res.data;
      } catch (err) {
        if (seq !== saveSeq.current) return null;
        setError(err.response?.data?.message || 'Save failed');
        return null;
      } finally {
        if (seq === saveSeq.current) setBusy(false);
      }
    }, [screen, setNotice]);

    return { data, busy, error, notice, setError, setNotice, load, save };
  };
}
