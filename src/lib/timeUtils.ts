/**
 * Time and Date Utilities for Tehran Timezone (Asia/Tehran - UTC+03:30)
 */

export const TEHRAN_TIMEZONE = 'Asia/Tehran';

/**
 * Formats time in Iranian Standard Time (HH:MM:SS or HH:MM)
 */
export function formatTehranTime(
  dateInput: Date | string | number = new Date(),
  includeSeconds = true
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('fa-IR', {
      timeZone: TEHRAN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
    });
  } catch (e) {
    return new Date(dateInput).toLocaleTimeString('fa-IR');
  }
}

/**
 * Formats date in Persian/Solar Hijri format to Tehran Timezone
 */
export function formatTehranDate(
  dateInput: Date | string | number = new Date()
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '----/--/--';
    return d.toLocaleDateString('fa-IR', {
      timeZone: TEHRAN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (e) {
    return new Date(dateInput).toLocaleDateString('fa-IR');
  }
}

/**
 * Formats complete Persian date and time in Tehran Timezone
 */
export function formatTehranDateTime(
  dateInput: Date | string | number = new Date()
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return 'نامشخص';
    const dateStr = formatTehranDate(d);
    const timeStr = formatTehranTime(d, false);
    return `${dateStr} - ساعت ${timeStr}`;
  } catch (e) {
    return String(dateInput);
  }
}
