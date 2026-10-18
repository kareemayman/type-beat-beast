import Card from '../components/Card'
import Mascot from '../components/Mascot'
import type { Screen } from '../components/Rail'
import styles from './ComingSoon.module.css'

// The screens that aren't built yet.
type LaterScreen = Exclude<Screen, 'new' | 'schedule'>

const TITLES: Record<LaterScreen, string> = { history: 'History', settings: 'Settings' }

// Stand-in for the screens built in the next steps.
export default function ComingSoon({ screen, reduceMotion }: { screen: LaterScreen; reduceMotion: boolean }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{TITLES[screen]}</h1>
      <Card className={styles.card}>
        <Mascot kind="tick" mood="wait" size={130} reduceMotion={reduceMotion} />
        <div className={styles.text}>
          <div className={styles.headline}>Still in the oven.</div>
          <div className={styles.note}>This screen is designed and gets built next.</div>
        </div>
      </Card>
    </div>
  )
}
