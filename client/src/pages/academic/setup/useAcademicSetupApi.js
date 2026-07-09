import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../api/client';

export function useAcademicSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const loadSeqRef = useRef(0);
  const saveSeqRef = useRef(0);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async (fields = {}) => {
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/academic/setup/${screen}/load`, { fields });
      if (seq !== loadSeqRef.current) return res.data;
      const { message, success, ...payload } = res.data || {};
      setData(payload);
      return res.data;
    } catch (err) {
      if (seq !== loadSeqRef.current) return null;
      setError(err.response?.data?.message || 'Unable to load academic setup');
      return null;
    } finally {
      if (seq === loadSeqRef.current) setBusy(false);
    }
  }, [screen]);

  const save = useCallback(async (fields) => {
    const seq = saveSeqRef.current + 1;
    saveSeqRef.current = seq;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/academic/setup/${screen}/save`, { fields });
      if (seq !== saveSeqRef.current) return res.data;
      if (res.data.success === false) {
        setError(res.data.message || 'Save failed');
      } else if (res.data.message) {
        setNotice(res.data.message);
      }
      const { message, success, ...payload } = res.data || {};
      setData(payload);
      return res.data;
    } catch (err) {
      if (seq !== saveSeqRef.current) return null;
      setError(err.response?.data?.message || 'Save failed');
      return null;
    } finally {
      if (seq === saveSeqRef.current) setBusy(false);
    }
  }, [screen]);

  return { data, busy, error, notice, clearNotice: () => setNotice(null), load, save };
}
