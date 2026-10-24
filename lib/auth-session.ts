import type { Session, User } from "@supabase/supabase-js";

/** Checks whether a candidate session can start (user must be confirmed). */
export function serverUserCanStartSession(
  session: Session | null,
  serverUser: User | null
): boolean {
  if (!session || !serverUser) return false;
  // Require email confirmed or OAuth identity
  const confirmed = serverUser.email_confirmed_at || serverUser.confirmed_at;
  const hasIdentity = (serverUser.identities?.length ?? 0) > 0;
  return Boolean(confirmed || hasIdentity);
}

/** Returns true if the session's user has a verified email. */
export function sessionIsVerified(session: Session | null): boolean {
  if (!session?.user) return false;
  return Boolean(session.user.email_confirmed_at || session.user.confirmed_at);
}
