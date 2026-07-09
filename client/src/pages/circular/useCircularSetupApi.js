import { useCallback, useState } from 'react';
import api from '../../api/client';

async function fileToPayload(file) {
  if (!file) return null;
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return { filename: file.name, dataBase64: btoa(binary) };
}

export function useCircularSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async (fields = {}, query = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/circular/setup/${screen}/load`, { fields, query });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load circular screen');
      setData(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, [screen]);

  const save = useCallback(async (fields, fileList = []) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const files = [];
      for (const f of fileList) {
        const payload = await fileToPayload(f);
        if (payload) files.push(payload);
      }
      const res = await api.post(`/api/circular/setup/${screen}/save`, { fields, files });
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
