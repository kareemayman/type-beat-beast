// The daily YouTube slots: one video a day at the publish time, in local time. The Schedule screen shows
// them, and the YouTube step (Phase 4) books each new video into the next free one.

export type VideoStatus = 'live' | 'scheduled' | 'uploading' | 'failed'

export interface ScheduledVideo {
  beat: string
  day: string // the day it goes out, "YYYY-MM-DD" in local time
  status: VideoStatus
  progress?: number // 0–100 while it uploads
  error?: string // why it failed
}

export interface Time {
  hours: number
  minutes: number
}

// "18:00" or "7:05" (24-hour) → hours and minutes; null if it isn't a time.
export function parseTime(text: string): Time | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text.trim())
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null
}

// Midnight, `days` days after `date`. Counting calendar days (not 24-hour blocks) keeps daylight saving out of it.
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

// Hours and minutes → "18:00".
export function formatTime({ hours, minutes }: Time): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// "YYYY-MM-DD" in local time. (toISOString would give the UTC day, which can be a different one.)
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// The other way round: "YYYY-MM-DD" → that day at midnight, local time.
export function fromDayKey(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

// When a day's video goes out: that day at the publish time.
export function slotOn(day: Date, time: Time): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hours, time.minutes)
}

// The first slot that's still ahead and has no video on its day. A failed upload keeps its day, so its
// retry can still go out then.
export function nextFreeSlot(videos: ScheduledVideo[], now: Date, time: Time): Date {
  const taken = new Set(videos.map((video) => video.day))
  // Each video fills one day, so a free one turns up within videos.length + 2 days.
  for (let i = 0; ; i++) {
    const slot = slotOn(addDays(now, i), time)
    if (slot > now && !taken.has(dayKey(slot))) return slot
  }
}
