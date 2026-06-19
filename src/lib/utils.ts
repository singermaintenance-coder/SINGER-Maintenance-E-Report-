import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from './firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(isoString: string) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoString: string) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString();
}

export function formatDateTime(isoString: string) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatTimeRange(startTimeStr: string, finishTimeStr: string) {
  if (!startTimeStr || !finishTimeStr) return '';
  const start = new Date(startTimeStr);
  const finish = new Date(finishTimeStr);
  
  if (isNaN(start.getTime()) || isNaN(finish.getTime())) return '';
  
  const isSameDay = 
    start.getFullYear() === finish.getFullYear() &&
    start.getMonth() === finish.getMonth() &&
    start.getDate() === finish.getDate();
    
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  
  const formatTimeStr = (d: Date) => d.toLocaleTimeString([], timeOpts);
  const formatDateStr = (d: Date) => d.toLocaleDateString([], dateOpts);
  
  if (isSameDay) {
    return `${formatTimeStr(start)} — ${formatTimeStr(finish)}`;
  } else {
    return `${formatDateStr(start)} ${formatTimeStr(start)} — ${formatDateStr(finish)} ${formatTimeStr(finish)}`;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null = null) {
  console.error(`[FirestoreErrorDetails] Detected error on path: "${path}" | Operation: "${operationType}"`, error);

  const code = error?.code || '';
  const message = error instanceof Error ? error.message : String(error);

  // If this is a connectivity warning or the service is temporarily unavailable, operate in offline mode gracefully rather than crashing.
  if (code === 'unavailable' || message.includes('Could not reach Cloud Firestore backend') || message.includes('unavailable') || message.includes('offline')) {
    console.warn(`[FirestoreErrorDetails] Firestore service is temporarily unavailable or offline. Operating in offline cache mode for path: "${path}" | Operation: "${operationType}"`);
    return;
  }

  const user = auth?.currentUser;
  
  const errInfo: FirestoreErrorInfo = {
    error: message,
    operationType,
    path,
    authInfo: {
      userId: user?.uid || null,
      email: user?.email || null,
      emailVerified: user?.emailVerified || null,
      isAnonymous: user?.isAnonymous || null,
      tenantId: user?.tenantId || null,
      providerInfo: user?.providerData?.map((p: any) => ({
        providerId: p.providerId,
        email: p.email || null,
      })) || [],
    },
  };

  const jsonErrorString = JSON.stringify(errInfo);
  console.error("[FirestoreErrorDetails] Prepared JSON Error String:", jsonErrorString);
  throw new Error(jsonErrorString);
}

export function parseShiftTime(timeStr: string) {
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  
  if (ampm === 'PM' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  return { hours, minutes };
}

// 2025 Sri Lankan Holidays Map
const HOLIDAYS_2025: Record<string, { name: string, type: 'Public' | 'Mercantile' | 'Poya' }> = {
  "2025-01-13": { name: "Duruthu Full Moon Poya Day", type: "Poya" },
  "2025-01-14": { name: "Tamil Thai Pongal Day", type: "Public" },
  "2025-02-04": { name: "National Day", type: "Public" },
  "2025-02-12": { name: "Navam Full Moon Poya Day", type: "Poya" },
  "2025-02-26": { name: "Mahasivarathri Day", type: "Public" },
  "2025-03-13": { name: "Medin Full Moon Poya Day", type: "Poya" },
  "2025-03-31": { name: "Eid al-Fitr (Ramazan Festival Day)", type: "Public" },
  "2025-04-12": { name: "Bak Full Moon Poya Day", type: "Poya" },
  "2025-04-13": { name: "Sinhala & Tamil New Year Eve", type: "Public" },
  "2025-04-14": { name: "Sinhala & Tamil New Year Day", type: "Public" },
  "2025-04-18": { name: "Good Friday", type: "Public" },
  "2025-05-01": { name: "May Day", type: "Public" },
  "2025-05-12": { name: "Vesak Full Moon Poya Day", type: "Poya" },
  "2025-05-13": { name: "Day following Vesak Full Moon Poya Day", type: "Public" },
  "2025-06-06": { name: "Eid al-Adha (Hajj Festival Day)", type: "Public" },
  "2025-06-10": { name: "Poson Full Moon Poya Day", type: "Poya" },
  "2025-07-10": { name: "Esala Full Moon Poya Day", type: "Poya" },
  "2025-08-08": { name: "Nikini Full Moon Poya Day", type: "Poya" },
  "2025-09-05": { name: "Milad-un-Nabi (Holy Prophet's Birthday)", type: "Public" },
  "2025-09-07": { name: "Binara Full Moon Poya Day", type: "Poya" },
  "2025-10-06": { name: "Vap Full Moon Poya Day", type: "Poya" },
  "2025-10-20": { name: "Deepavali Festival Day", type: "Public" },
  "2025-11-05": { name: "Il Full Moon Poya Day", type: "Poya" },
  "2025-12-04": { name: "Unduvap Full Moon Poya Day", type: "Poya" },
  "2025-12-25": { name: "Christmas Day", type: "Public" },
};

// 2026 Sri Lankan Holidays Map
const HOLIDAYS_2026: Record<string, { name: string, type: 'Public' | 'Mercantile' | 'Poya' }> = {
  "2026-01-02": { name: "Duruthu Full Moon Poya Day", type: "Poya" },
  "2026-01-15": { name: "Tamil Thai Pongal Day", type: "Public" },
  "2026-02-01": { name: "Navam Full Moon Poya Day", type: "Poya" },
  "2026-02-04": { name: "National Day", type: "Public" },
  "2026-02-17": { name: "Mahasivarathri Day", type: "Public" },
  "2026-03-03": { name: "Medin Full Moon Poya Day", type: "Poya" },
  "2026-03-20": { name: "Eid al-Fitr (Ramazan Festival Day)", type: "Public" },
  "2026-04-01": { name: "Bak Full Moon Poya Day", type: "Poya" },
  "2026-04-03": { name: "Good Friday", type: "Public" },
  "2026-04-13": { name: "Sinhala & Tamil New Year Eve", type: "Public" },
  "2026-04-14": { name: "Sinhala & Tamil New Year Day", type: "Public" },
  "2026-05-01": { name: "May Day / Vesak Full Moon Poya Day", type: "Poya" },
  "2026-05-02": { name: "Day following Vesak Poya Day", type: "Public" },
  "2026-05-27": { name: "Eid al-Adha (Hajj Festival Day)", type: "Public" },
  "2026-05-30": { name: "Poson Full Moon Poya Day", type: "Poya" },
  "2026-06-29": { name: "Esala Full Moon Poya Day", type: "Poya" },
  "2026-07-28": { name: "Nikini Full Moon Poya Day", type: "Poya" },
  "2026-08-25": { name: "Milad-un-Nabi (Holy Prophet's Birthday)", type: "Public" },
  "2026-08-27": { name: "Binara Full Moon Poya Day", type: "Poya" },
  "2026-09-25": { name: "Vap Full Moon Poya Day", type: "Poya" },
  "2026-10-25": { name: "Il Full Moon Poya Day", type: "Poya" },
  "2026-11-08": { name: "Deepavali Festival Day", type: "Public" },
  "2026-11-24": { name: "Unduvap Full Moon Poya Day", type: "Poya" },
  "2026-12-23": { name: "Margosa (Duruthu Full Moon Poya Day)", type: "Poya" },
  "2026-12-25": { name: "Christmas Day", type: "Public" },
};

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dDay = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dDay}`;
}

export function getSriLankanHoliday(date: Date): { name: string, type: 'Public' | 'Mercantile' | 'Poya' } | null {
  const dStr = formatLocalDate(date);
  return HOLIDAYS_2025[dStr] || HOLIDAYS_2026[dStr] || null;
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

export function getShiftForDate(date: Date, baseShift: string): string | null {
  if (baseShift.includes('24 Hours') || baseShift === '7:30 AM - 7:30 AM (24 Hours)') {
    return '7:30 AM - 7:30 AM';
  }

  // Check if it's a holiday in Sri Lanka
  if (getSriLankanHoliday(date)) {
    return null; // non-working holiday
  }
  
  // Check Sunday (always non-working unless configured/explicitly a specific shift)
  if (date.getDay() === 0) {
    return null; // Sundays are non-working
  }
  
  // Saturday Shift rule
  if (date.getDay() === 6) {
    if (baseShift.includes('4:30 PM')) {
      return '7:30 AM - 1:00 PM';
    } else {
      return '7:30 AM - 9:40 PM';
    }
  }
  
  // Weekday Shift (Monday - Friday)
  return baseShift;
}

export function calculateShiftDuration(startISO: string, finishISO: string, shiftStr: string): number {
  if (!startISO || !finishISO) return 0;
  const startMs = new Date(startISO).getTime();
  const finishMs = new Date(finishISO).getTime();
  if (startMs >= finishMs) return 0;

  if (!shiftStr || shiftStr === 'None Shift') {
    return 0;
  }

  let totalMinutes = 0;

  const startDate = new Date(startMs);
  const endDate = new Date(finishMs);

  const startDay = new Date(startDate);
  startDay.setDate(startDay.getDate() - 2);

  const endDay = new Date(endDate);
  endDay.setDate(endDay.getDate() + 2);

  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);

  const currentDay = new Date(startDay);
  while (currentDay <= endDay) {
    const dailyShift = getShiftForDate(currentDay, shiftStr);
    
    if (dailyShift && dailyShift !== 'None Shift') {
      const parts = dailyShift.split('-').map(s => s.trim());
      if (parts.length === 2) {
        const startParsed = parseShiftTime(parts[0]);
        const endParsed = parseShiftTime(parts[1]);
        
        if (startParsed && endParsed) {
          const sDate = new Date(currentDay);
          sDate.setHours(startParsed.hours, startParsed.minutes, 0, 0);

          const eDate = new Date(currentDay);
          if (endParsed.hours < startParsed.hours || (endParsed.hours === startParsed.hours && endParsed.minutes <= startParsed.minutes)) {
            eDate.setDate(eDate.getDate() + 1);
          }
          eDate.setHours(endParsed.hours, endParsed.minutes, 0, 0);

          const sTime = sDate.getTime();
          const eTime = eDate.getTime();

          const overlapStart = Math.max(sTime, startMs);
          const overlapEnd = Math.min(eTime, finishMs);

          if (overlapStart < overlapEnd) {
            totalMinutes += (overlapEnd - overlapStart) / 60000;
          }
        }
      }
    }

    currentDay.setDate(currentDay.getDate() + 1);
  }

  return Math.round(totalMinutes);
}

