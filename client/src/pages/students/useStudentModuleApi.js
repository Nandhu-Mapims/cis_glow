import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';

function useTransientNotice() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  return [notice, setNotice];
}

export function useStudentScreenApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice();

  useEffect(() => {
    setData(null);
    setError(null);
    setNotice(null);
    setBusy(false);
  }, [screen]);

  const load = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/students/screens/${screen}/load`, { fields });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load screen');
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen]);

  const save = useCallback(async (fields) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/students/screens/${screen}/save`, { fields });
      if (res.data.error) {
        setError(res.data.error);
        return null;
      }
      if (res.data.message) setNotice(res.data.message);
      setData((prev) => ({ ...(prev || {}), ...res.data }));
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen]);

  const searchMore = useCallback(async (query) => {
    const res = await api.get(`/api/students/screens/${screen}/more`, { params: query });
    return res.data;
  }, [screen]);

  return { data, busy, error, notice, setError, setNotice, load, save, searchMore };
}
