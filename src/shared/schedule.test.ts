import { describe, expect, it } from 'vitest'
import { addDays, dayKey, formatTime, fromDayKey, nextFreeSlot, parseTime, type ScheduledVideo } from './schedule'

const SIX_PM = { hours: 18, minutes: 0 }
const october = (day: number, hours = 0, minutes = 0) => new Date(2026, 9, day, hours, minutes) // local time
const booked = (day: string, status: ScheduledVideo['status'] = 'scheduled'): ScheduledVideo => ({ beat: 'beat', day, status })

describe('parseTime', () => {
  it('reads 24-hour times', () => {
    expect(parseTime('18:00')).toEqual({ hours: 18, minutes: 0 })
    expect(parseTime('7:05')).toEqual({ hours: 7, minutes: 5 })
    expect(parseTime('00:30')).toEqual({ hours: 0, minutes: 30 })
  })

  it('rejects anything else', () => {
    for (const text of ['', '24:00', '18:60', '18', '18:0', '6 PM']) expect(parseTime(text)).toBeNull()
  })

  it('round-trips through formatTime', () => {
    expect(formatTime({ hours: 7, minutes: 5 })).toBe('07:05')
    expect(formatTime(parseTime('18:00')!)).toBe('18:00')
  })
})

describe('dayKey and addDays', () => {
  it('use the local day', () => {
    expect(dayKey(october(5, 23, 59))).toBe('2026-10-05')
    expect(dayKey(october(18, 0, 1))).toBe('2026-10-18')
  })

  it('turn back into dates with fromDayKey', () => {
    expect(fromDayKey('2026-10-18')).toEqual(october(18))
    expect(dayKey(fromDayKey('2027-01-31'))).toBe('2027-01-31')
  })

  it('roll over months and years', () => {
    expect(dayKey(addDays(october(31, 12), 1))).toBe('2026-11-01')
    expect(dayKey(addDays(october(1, 12), -1))).toBe('2026-09-30')
    expect(dayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01')
  })
})

describe('nextFreeSlot', () => {
  it("is today while today is free and the time hasn't come yet", () => {
    expect(nextFreeSlot([], october(18, 9), SIX_PM)).toEqual(october(18, 18))
  })

  it("moves to tomorrow once today's time has come", () => {
    expect(nextFreeSlot([], october(18, 18), SIX_PM)).toEqual(october(19, 18))
    expect(nextFreeSlot([], october(18, 21, 30), SIX_PM)).toEqual(october(19, 18))
  })

  it('skips days that already have a video', () => {
    const videos = [booked('2026-10-18'), booked('2026-10-19'), booked('2026-10-21')]
    expect(nextFreeSlot(videos, october(18, 9), SIX_PM)).toEqual(october(20, 18))
  })

  it('keeps the day of a failed upload for its retry', () => {
    expect(nextFreeSlot([booked('2026-10-18', 'failed')], october(18, 9), SIX_PM)).toEqual(october(19, 18))
  })

  it('ignores videos from past days', () => {
    expect(nextFreeSlot([booked('2026-10-17', 'live')], october(18, 9), SIX_PM)).toEqual(october(18, 18))
  })

  it('carries on into the next month', () => {
    expect(nextFreeSlot([booked('2026-10-31')], october(31, 9), SIX_PM)).toEqual(new Date(2026, 10, 1, 18))
  })
})
