import { useCallback, useState } from 'react';
import api from '../../api/client';
import { useTransientNotice } from '../../hooks/useTransientNotice';

function stripSaveMeta(payload = {}) {
  const { message, success, ...rest } = payload;
  return rest;
}

function mergePayrollCloseSaveData(prev, patch) {
  if (!prev) return patch;
  const next = { ...prev, ...patch };
  if (patch.selectedId != null && patch.payrollComplete != null && prev.monthOptions) {
    next.monthOptions = prev.monthOptions.map((opt) => (
      opt.value === String(patch.selectedId)
        ? { ...opt, payrollComplete: patch.payrollComplete }
        : opt
    ));
  }
  return next;
}

export function usePayrollSetupApi(screen) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice();

  const load = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/payroll/setup/${screen}/load`, { fields });
      if (res.data.error) {
        setError(res.data.error);
        setData(null);
        return null;
      }
      setData(stripSaveMeta(res.data));
      return stripSaveMeta(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load payroll screen');
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
      const res = await api.post(`/api/payroll/setup/${screen}/save`, { fields, files });
      if (res.data.success === false) {
        setError(res.data.message || 'Save failed');
        setData((prev) => mergePayrollCloseSaveData(prev, stripSaveMeta(res.data)));
      } else if (res.data.message) {
        setNotice(res.data.message);
        setData((prev) => mergePayrollCloseSaveData(prev, stripSaveMeta(res.data)));
      } else {
        setData((prev) => mergePayrollCloseSaveData(prev, stripSaveMeta(res.data)));
      }
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
