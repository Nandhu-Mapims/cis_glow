import { useCallback, useState } from 'react';
import api from '../../../api/client';
import { useTransientNotice } from '../../../hooks/useTransientNotice';

export function useExamSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice(4000);

  const load = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/exam/setup/${screen}/load`, { fields });
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load exam setup');
      setData(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen]);

  const save = useCallback(async (fields, files = []) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/exam/setup/${screen}/save`, { fields, files });
      if (res.data.success === false) {
        setError(res.data.message || 'Save failed');
      } else if (res.data.message) {
        setNotice(res.data.message);
      }
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen, setNotice]);

  return {
    data,
    busy,
    error,
    notice,
    setNotice,
    clearNotice: () => setNotice(null),
    load,
    save,
  };
}
