export type ShareResult = 'shared' | 'copied' | 'failed';

export async function shareInviteUrl(params: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareResult> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(params);
      return 'shared';
    }
  } catch (err) {
    // If the user dismissed the native share sheet, don't treat as fatal error,
    // fall back to copying to clipboard so they always have the link ready.
    if (err instanceof Error && err.name === 'AbortError') {
      return 'shared';
    }
  }

  try {
    await navigator.clipboard.writeText(params.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
