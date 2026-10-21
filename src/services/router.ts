import { useEffect, useState } from "react";
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
    const listener = () => {
      scrollPositions.set(previous, window.scrollY);
      const next = location.hash;
      const samePath = previous.split("?")[0] === next.split("?")[0];
      const position =
        scrollPositions.get(next) ?? (samePath ? window.scrollY : 0);
      previous = next;
      setRoute(readRoute());
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        window.scrollTo({ top: position, behavior: "instant" }),
      );
    };
    window.addEventListener("hashchange", listener);
    return () => {
      window.removeEventListener("hashchange", listener);
      cancelAnimationFrame(frame);
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
  location.hash = href(path, params).slice(1);
}
