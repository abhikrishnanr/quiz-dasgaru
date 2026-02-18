const SESSION_QUERY_PARAM = 'sessionId';

/**
 * Accepts either a plain session ID or a full URL that includes `sessionId`.
 */
export const normalizeSessionId = (rawValue: string | null | undefined) => {
  const value = rawValue?.trim() ?? '';
  if (!value) {
    return '';
  }

  try {
    const parsedUrl = new URL(value);
    return (parsedUrl.searchParams.get(SESSION_QUERY_PARAM)?.trim() ?? '').toUpperCase();
  } catch {
    // Treat non-URL values as direct session IDs.
  }

  return value.toUpperCase();
};

