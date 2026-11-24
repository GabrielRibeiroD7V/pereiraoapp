import { useEffect, useState } from "react";
/** Reconsulta ao retornar, sem armazenar dados nem limpar sessão/cache. */
export function useReturnRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      timer = setTimeout(() => {
        if (document.visibilityState !== "hidden") setRevision((n) => n + 1);
      }, 150);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return revision;
}
