import { useState, useEffect } from 'react';

/**
 * Returns true only after `loading` has been true for `delay` ms.
 * Prevents flickering loaders on fast requests.
 */
export default function useDelayedLoading(loading, delay = 300) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [loading, delay]);

  return show;
}
