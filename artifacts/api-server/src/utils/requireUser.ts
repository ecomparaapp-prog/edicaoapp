/**
 * Validates that a user_id looks like a real eCompara account.
 * Rejects: undefined, empty, "anonymous", "anon_*" fallback IDs.
 */
export function isValidUserId(id: string | undefined | null): id is string {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (trimmed === "anonymous") return false;
  if (trimmed.startsWith("anon_")) return false;
  return true;
}

export function requireUserMiddleware(
  userIdGetter: (body: any) => string | undefined | null,
  fieldName = "userId",
) {
  return (req: any, res: any, next: any) => {
    const id = userIdGetter(req.body);
    if (!isValidUserId(id)) {
      res.status(401).json({
        error: `${fieldName} inválido ou ausente. Faça login para continuar.`,
      });
      return;
    }
    next();
  };
}
