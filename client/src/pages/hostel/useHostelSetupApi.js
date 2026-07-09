import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';

function stripSaveMeta(payload = {}) {
  const { message, success, ...data } = payload;
  return data;
}

function useTransientNotice() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  return [notice, setNotice];
}

export function useHostelSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice();

  const load = useCallback(async (fields = {}, query = {}) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/hostel/setup/${screen}/load`, { fields, query });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      setData(stripSaveMeta(res.data));
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load hostel screen');
      setData(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen, setNotice]);

  const save = useCallback(async (fields, files = []) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/hostel/setup/${screen}/save`, { fields, files });
      if (res.data.success === false) {
        setError(res.data.message || 'Save failed');
      } else if (res.data.message) {
        setNotice(res.data.message);
      }
      setData(stripSaveMeta(res.data));
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen, setNotice]);

  return { data, busy, error, notice, setError, setNotice, clearNotice: () => setNotice(null), load, save };
}
