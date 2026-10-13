import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { buildFyOptions, currentFyLabel, currentFyRange, fyDateRange } from '../pages/billing/billingUtils';

const AdminFyContext = createContext(null);

export function useAdminFy() {
  return useContext(AdminFyContext);
}

export function AdminFyProvider({ children }) {
  // Financial Year state is in-memory only (resets to current FY on page reload, no storage)
  const fyOptions = useMemo(() => buildFyOptions(), []);
  const [fy, setFy] = useState(() => currentFyLabel());
  const range = useMemo(() => fyDateRange(fy) || currentFyRange(), [fy]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshFnRef = useRef(null);

  const registerRefresh = useCallback((fn) => {
    refreshFnRef.current = fn;
    return () => {
      if (refreshFnRef.current === fn) refreshFnRef.current = null;
    };
  }, []);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (refreshFnRef.current) {
        await refreshFnRef.current();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      fy,
      setFy,
      fyOptions,
      range,
      refreshing,
      triggerRefresh,
      registerRefresh,
    }),
    [fy, fyOptions, range, refreshing, triggerRefresh, registerRefresh]
  );

  return (
    <AdminFyContext.Provider value={value}>
      {children}
    </AdminFyContext.Provider>
  );
}

export default AdminFyContext;
