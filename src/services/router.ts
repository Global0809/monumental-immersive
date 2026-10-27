import { useEffect, useState } from "react";
import { routeScrollPosition } from './routeScroll';
let intendedHash: string | null = null;
export function readRoute() {
  const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
  return { path, params: new URLSearchParams(query) };
}
const scrollPositions = new Map<string, number>();
export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    let previous = location.hash;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    let expiry = 0;
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const cancelRestore = () => { cancelAnimationFrame(frame); observer?.disconnect(); observer = null; window.clearTimeout(expiry); };
    const trackLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (link && (!link.target || link.target === '_self') && link.origin === location.origin && link.pathname === location.pathname && link.search === location.search && link.hash.startsWith('#/') && link.hash !== location.hash) intendedHash = link.hash;
    };
    const cancelWithKeyboard = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelRestore();
    };
    const listener = () => {
      cancelRestore();
      scrollPositions.set(previous, window.scrollY);
      if (scrollPositions.size > 120) scrollPositions.delete(scrollPositions.keys().next().value!);
      const next = location.hash;
      const intentional = intendedHash === next;
      const samePage = previous.split('?')[0] === next.split('?')[0];
      const position = routeScrollPosition(previous, next, window.scrollY, scrollPositions.get(next), intentional);
      intendedHash = null;
      previous = next;
      setRoute(readRoute());
      // Query controls keep ownership of the current scroll. Even a scrollTo
      // the same offset cancels native smooth scrolling started by that control
      // (for example, following a World connection back to its destination).
      // Browser Back/Forward still restores the saved reading position below.
      if (intentional && samePage) return;
      const restore = () => {
        window.scrollTo({ top: position, behavior: 'instant' });
        if (position <= Math.max(0, document.documentElement.scrollHeight - innerHeight)) cancelRestore();
      };
      frame = requestAnimationFrame(() => {
        observer = new ResizeObserver(restore);
        observer.observe(document.getElementById('main') || document.body);
        restore();
        expiry = window.setTimeout(cancelRestore, 1800);
      });
    };
    // React's delegated handlers run before document bubbling. A prevented
    // Search click opens a dialog, so it must not leave a stale route intent.
    document.addEventListener('click', trackLink);
    window.addEventListener('wheel', cancelRestore, { passive: true });
    window.addEventListener('touchstart', cancelRestore, { passive: true });
    window.addEventListener('keydown', cancelWithKeyboard);
    window.addEventListener("hashchange", listener);
    return () => {
      document.removeEventListener('click', trackLink);
      window.removeEventListener('wheel', cancelRestore);
      window.removeEventListener('touchstart', cancelRestore);
      window.removeEventListener('keydown', cancelWithKeyboard);
      history.scrollRestoration = previousRestoration;
      window.removeEventListener("hashchange", listener);
      cancelRestore();
    };
  }, []);
  return route;
}
export function href(
  path: string,
  params: Record<string, string | undefined> = {},
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) query.set(k, v);
  });
  return `#${path}${query.size ? "?" + query.toString() : ""}`;
}
export function go(
  path: string,
  params: Record<string, string | undefined> = {},
) {
  // The persistent spatial shell can coordinate an exit before committing.
  // Filters on the current page and consumers without that shell stay native.
  if (!window.dispatchEvent(new CustomEvent('monumental:navigate', {
    detail: { path, params }, cancelable: true,
  }))) return;
  commitRoute(path, params);
}
export function commitRoute(path: string, params: Record<string, string | undefined> = {}) {
  const next = href(path, params);
  if (next === location.hash) return;
  intendedHash = next;
  location.hash = next.slice(1);
}
