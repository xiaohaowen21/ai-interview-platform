const DISPLAY_TIME_ZONE = 'Asia/Shanghai';
const ISO_WITH_TIMEZONE = /(Z|[+-]\d{2}:\d{2})$/i;
const ISO_LIKE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

function parseBackendDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) {
    return null;
  }

  const normalized = dateStr.trim();
  if (!normalized) {
    return null;
  }

  if (ISO_WITH_TIMEZONE.test(normalized)) {
    const zonedDate = new Date(normalized);
    return Number.isNaN(zonedDate.getTime()) ? null : zonedDate;
  }

  const matched = normalized.match(ISO_LIKE_PATTERN);
  if (matched) {
    const [, year, month, day, hour = '00', minute = '00', second = '00', millisecond = '0'] = matched;
    const shanghaiDate = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond.padEnd(3, '0')}+08:00`
    );
    return Number.isNaN(shanghaiDate.getTime()) ? null : shanghaiDate;
  }

  const fallbackDate = new Date(normalized);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

export { parseBackendDate };

export function getDateTimestamp(dateStr: string | null | undefined): number {
  const date = parseBackendDate(dateStr);
  return date?.getTime() ?? 0;
}

export function formatDate(
  dateStr: string | null | undefined,
  options?: {
    year?: 'numeric' | '2-digit';
    month?: 'numeric' | '2-digit';
    day?: 'numeric' | '2-digit';
    hour?: '2-digit';
    minute?: '2-digit';
  }
): string {
  const date = parseBackendDate(dateStr);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: DISPLAY_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(date);
}

export function formatDateTime(dateStr: string | null | undefined): string {
  return formatDate(dateStr, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(dateStr: string | null | undefined): string {
  return formatDate(dateStr, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatTimeAgo(dateStr: string | null | undefined): string {
  const date = parseBackendDate(dateStr);
  if (!date) {
    return '-';
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return formatDateOnly(dateStr);
}
