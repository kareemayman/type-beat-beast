import { addDays, dayKey, slotOn, type ScheduledVideo, type Time } from '../../../shared/schedule'

// Made-up beats for the Schedule and History screens, placed around today so both tell the same story:
// each beat below was cooked a few days ago and holds one daily slot. Phase 4 swaps the schedule for
// YouTube's, and real runs get recorded once the steps are real.

export function demoVideos(now: Date, time: Time): ScheduledVideo[] {
  const day = (offset: number) => dayKey(addDays(now, offset))
  return [
    { beat: '8 bit', day: day(-1), status: 'live' },
    { beat: 'flowers', day: day(0), status: slotOn(now, time) <= now ? 'live' : 'scheduled' },
    { beat: 'no hook', day: day(2), status: 'uploading', progress: 48 },
    { beat: 'mercury', day: day(3), status: 'failed', error: "YouTube's daily upload limit was hit. Retry tomorrow, once it resets." },
    { beat: 'glock tears', day: day(4), status: 'scheduled' },
  ]
}

export interface DemoRun {
  beat: string
  meta: string // "140 BPM · E min"
  cookedAt: Date
  seconds: number // how long the run took
}

export function demoRuns(now: Date): DemoRun[] {
  const at = (daysAgo: number, hours: number, minutes: number) => {
    const day = addDays(now, -daysAgo)
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes)
  }
  return [
    { beat: 'flowers', meta: '140 BPM · E min', cookedAt: at(1, 21, 14), seconds: 304 },
    { beat: '8 bit', meta: '151 BPM · D# min', cookedAt: at(2, 23, 40), seconds: 281 },
    { beat: 'mercury', meta: '160 BPM · G min', cookedAt: at(3, 16, 5), seconds: 252 },
    { beat: 'no hook', meta: '128 BPM · A min', cookedAt: at(4, 19, 22), seconds: 295 },
    { beat: 'glock tears', meta: '145 BPM · C# min', cookedAt: at(5, 22, 47), seconds: 320 },
  ]
}
