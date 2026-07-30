import { useCallback, useEffect, useState } from 'react';
import api from '../../../api/client';
import { cachedByDate, invalidateCachePrefix, STORAGE } from '../../../utils/idbCache';

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
    const isPlainReportLoad = !fields.resolve_students && !fields.card_register_no && !fields.generate_cards;
    try {
      const fetchLoad = async () => {
        const res = await api.post(`/api/attendance/students/${screen}/load`, { fields });
        if (res.data.error) throw Object.assign(new Error(res.data.error), { screenError: res.data.error });
        return res.data;
      };

      // Report loads are filtered by a date range: today's range can still change (session
      // storage, short TTL), a fully-past range is treated as settled history (IndexedDB,
      // long TTL) so we don't refetch the same closed day's attendance on every visit.
      const resData = isPlainReportLoad
        ? await cachedByDate(
            `attendance/students/${screen}/load:${JSON.stringify(fields)}`,
            fields.to_date || fields.from_date,
            fetchLoad,
            {
              onCache: (cached) => setData(cached),
              onFresh: (fresh) => setData(fresh),
            },
          )
        : await fetchLoad();

      if (fields.resolve_students) {
        setData((prev) => ({ ...(prev || {}), student_list: resData.student_list || '' }));
      } else if (fields.card_register_no || fields.generate_cards) {
        return resData;
      } else {
        setData(resData);
      }
      return resData;
    } catch (err) {
      setError(err.screenError || err.response?.data?.message || 'Unable to load screen');
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
      const prefix = `attendance/students/${screen}/load:`;
      invalidateCachePrefix(prefix, STORAGE.SESSION);
      invalidateCachePrefix(prefix, STORAGE.IDB);
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
