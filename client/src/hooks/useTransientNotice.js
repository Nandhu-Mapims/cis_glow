import { useEffect, useState } from 'react';

export function useTransientNotice(ms = 2500) {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), ms);
    return () => clearTimeout(timer);
  }, [notice, ms]);

  return [notice, setNotice];
}
