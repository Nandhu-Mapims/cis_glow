import { useCallback, useState } from 'react';
import api from '../../../api/client';
import { useTransientNotice } from '../../../hooks/useTransientNotice';

export function useFeeSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice(4000);

  const load = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/fees/setup/${screen}/load`, { fields });
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load fee setup');
      setData(null);
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
      const res = await api.post(`/api/fees/setup/${screen}/save`, { fields });
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
  }, [screen]);

  return {
    data,
    busy,
    error,
    notice,
    setError,
    setNotice,
    clearNotice: () => setNotice(null),
    load,
    save,
  };
}
