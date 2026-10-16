import { Pencil } from 'lucide-react'
import Card from '../../components/Card'
import { Segmented, Switch } from '../../components/controls'
import type { Beat } from '../../lib/beat'
import styles from './OptionsCard.module.css'

interface OptionsCardProps {
  stems: boolean
  bsFile: Beat['bsFile']
  quality: string
  onChange(patch: Partial<Pick<Beat, 'stems' | 'bsFile'>>): void
  onGoSettings(): void
}

// Per-beat options. They start from the defaults in Settings and can be changed for this beat only.
export default function OptionsCard({ stems, bsFile, quality, onChange, onGoSettings }: OptionsCardProps) {
  return (
    <Card sticker="Options" stickerColor="var(--green)" className={styles.card} aria-label="Options">
      <div className={styles.row}>
        <span className={styles.label}>Upload stems</span>
        <Switch checked={stems} label="Upload stems" onChange={(checked) => onChange({ stems: checked })} />
      </div>
      <div className={styles.row}>
        <span className={styles.label}>BeatStars file</span>
        <Segmented
          label="BeatStars file"
          value={bsFile}
          options={[
            ['mp3', 'Tagged MP3'],
            ['wav', 'Reuse WAV'],
          ]}
          onChange={(value) => onChange({ bsFile: value })}
        />
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Quality</span>
        <button className={styles.quality} title="Change in Settings" onClick={onGoSettings}>
          {quality}
          <Pencil size={12} strokeWidth={3} />
        </button>
      </div>
    </Card>
  )
}
