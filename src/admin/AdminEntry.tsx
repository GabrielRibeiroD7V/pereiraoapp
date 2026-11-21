import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "./AdminProvider";
import { useAuth } from "../auth/AuthProvider";
import { usePublicQuery } from "../marketplace/usePublicQuery";

export function AdminEntry() {
  const repo = useAdmin(),
    { session } = useAuth();
  const load = useCallback(async () => {
    try {
      return session && repo ? await repo.access() : false;
    } catch {
      return false;
    }
  }, [repo, session]);
  const access = usePublicQuery(session?.user.id ?? "", load);
  return access.data ? (
    <Link className="text-link" to="/admin">
      Painel administrativo
    </Link>
  ) : null;
}
