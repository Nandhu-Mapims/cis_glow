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

export function useStaffSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice();

  const load = useCallback(async (fields = {}, query = {}) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/staff/setup/${screen}/load`, { fields, query });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      setData(stripSaveMeta(res.data));
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load screen');
      setData(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen, setNotice]);

  const save = useCallback(async (fields) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/staff/setup/${screen}/save`, { fields });
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

  const searchMore = useCallback(async (query) => {
    const res = await api.get(`/api/staff/setup/${screen}/more`, { params: query });
    return res.data;
  }, [screen]);

  return { data, busy, error, notice, setError, setNotice, clearNotice: () => setNotice(null), load, save, searchMore };
}

export function useStaffScreenApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice();

  const load = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/staff/screens/${screen}/load`, { fields });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      setData(stripSaveMeta(res.data));
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load screen');
      setData(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen, setNotice]);

  const save = useCallback(async (fields) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/staff/screens/${screen}/save`, { fields });
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

  const searchMore = useCallback(async (query) => {
    const res = await api.get(`/api/staff/screens/${screen}/more`, { params: query });
    return res.data;
  }, [screen]);

  return { data, busy, error, notice, setError, setNotice, clearNotice: () => setNotice(null), load, save, searchMore };
}
