import { useCallback, useEffect, useState } from 'react';
import api from '../../../api/client';

export function useStudentAttScreenApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setData(null);
    setError(null);
    setNotice(null);
  }, [screen]);

  const load = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/attendance/students/${screen}/load`, { fields });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      if (fields.resolve_students) {
        setData((prev) => ({ ...(prev || {}), student_list: res.data.student_list || '' }));
      } else if (fields.card_register_no || fields.generate_cards) {
        return res.data;
      } else {
        setData(res.data);
      }
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load screen');
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
      const res = await api.post(`/api/attendance/students/${screen}/save`, { fields });
      if (res.data.error) {
        setError(res.data.error);
        return null;
      }
      if (res.data.message) setNotice(res.data.message);
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen]);

  return { data, busy, error, notice, clearNotice: () => setNotice(null), load, save };
}
