import { useCallback, useEffect, useState } from 'react';
import { operationalDate, watchOperationalDay } from '../utils/operationalDay';

export function useOperationalDay() {
  const [day, setDay] = useState(operationalDate);
  useEffect(() => watchOperationalDay(setDay), []);
  const refreshDay = useCallback(() => {
    const current = operationalDate();
    setDay(current);
    return current;
  }, []);
  return [day, refreshDay];
}
