const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'ogg', 'm4v'];

function extractCandidate(value: string): string {
  if (!value) {
    return '';
  }

  if (value.startsWith('data:video/')) {
    return 'video';
  }

  try {
    const parsed = new URL(value, window.location.origin);
    const storageKey = parsed.searchParams.get('key');
    if (storageKey) {
      return decodeURIComponent(storageKey).toLowerCase();
    }
    return parsed.pathname.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

export function isVideoAssetUrl(value: string): boolean {
  const candidate = extractCandidate(value);
  if (!candidate) {
    return false;
  }

  if (candidate === 'video') {
    return true;
  }

  return VIDEO_EXTENSIONS.some((extension) => candidate.includes(`.${extension}`));
}
