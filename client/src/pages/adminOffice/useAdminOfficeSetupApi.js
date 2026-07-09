import { useCallback, useState } from 'react';
import api from '../../api/client';

export function useAdminOfficeSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async (fields = {}, query = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/admin-office/setup/${screen}/load`, { fields, query });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load admin office form');
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
      const res = await api.post(`/api/admin-office/setup/${screen}/save`, { fields });
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

  return { data, busy, error, notice, setError, setNotice, load, save };
}
