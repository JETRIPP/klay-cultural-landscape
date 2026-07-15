// A non-2xx response from a serverless function that got killed by a
// platform timeout (or any other gateway-level failure) comes back as an
// HTML/plain-text error page, not JSON - calling res.json() on that throws a
// cryptic native parse exception instead of the clean error message our own
// routes normally return. Callers should use this instead of res.json()
// directly so a request failing for any reason still surfaces something
// readable.
export async function parseJsonResponse(res: Response): Promise<{ error?: string } & Record<string, unknown> | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function fallbackErrorMessage(res: Response): string {
  if (res.status === 504) {
    return "The request took too long and timed out. Try again, or use a more specific name/URL.";
  }
  return `Something went wrong (server returned ${res.status}). Try again.`;
}
