import { Check, ExternalLink, FileArchive, FileAudio, Rocket, type LucideIcon } from 'lucide-react'
import Card from '../../components/Card'
import ConfirmButton from '../../components/ConfirmButton'
import { longKey, type Beat } from '../../lib/beat'
import { DEMO } from '../../lib/pipeline'
import styles from './Review.module.css'

interface ReviewProps {
  beat: Beat
  freeDownload: boolean
  onPublish(button: DOMRect): void
  onOpenBrowser(): void
  onStop(): void
}

// "Your turn": BeatStars is filled in and waits for the user's OK before anything goes public.
export default function Review({ beat, freeDownload, onPublish, onOpenBrowser, onStop }: ReviewProps) {
  const rows: [string, string][] = [
    ['Title', beat.name],
    ['BPM', beat.bpm],
    ['Key', longKey(beat.key)],
    ...(beat.collabs.length ? beat.collabs.map((name): [string, string] => ['Collab', name]) : [['Collab', 'Solo beat'] as [string, string]]),
  ]
  // The files from the beat folder (see CLAUDE.md, "Beat folder").
  const project = beat.fileName.replace(/\.flp$/i, '') || beat.name
  const files: { icon: LucideIcon; color: string; name: string }[] = [
    ...(beat.bsFile === 'mp3' ? [{ icon: FileAudio, color: '#FF6500', name: `${project} TAGGED.mp3` }] : []),
    { icon: FileAudio, color: '#38BDF8', name: `${project}.wav` },
    ...(beat.stems ? [{ icon: FileArchive, color: '#A78BFA', name: `${beat.name}.rar` }] : []),
  ]

  return (
    <Card sticker="Your turn" stickerColor="var(--sky)" className={styles.card} aria-label="BeatStars review">
      <div className={styles.details}>
        <div className={styles.title}>Check BeatStars before it goes live</div>
        <div className={styles.subtitle}>
          {DEMO ? "Demo: BeatStars isn't filled in yet. The files below are real, in the beat folder." : "It's filled in and saved as a draft. Nothing is public yet."}
        </div>
        <div className={styles.rows}>
          {rows.map(([label, value], i) => (
            <div key={i} className={styles.row}>
              <span className={styles.label}>{label}</span>
              <span className={styles.value}>{value || '—'}</span>
              <span className={styles.flag}>
                <Check size={14} strokeWidth={3} />
                Matched
              </span>
            </div>
          ))}
          <div className={styles.row}>
            <span className={styles.label}>Free download</span>
            <span className={styles.value}>Tagged MP3, non-commercial</span>
            <span className={styles.flag} data-off={!freeDownload}>
              {freeDownload ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.side}>
        <span className={styles.label}>{files.length} files attached</span>
        {files.map(({ icon: Icon, color, name }) => (
          <span key={name} className={styles.file}>
            <Icon size={16} strokeWidth={2.5} color={color} />
            <span className={styles.fileName}>{name}</span>
          </span>
        ))}
        <span className={styles.spacer} />
        <button className={styles.publish} onClick={(e) => onPublish(e.currentTarget.getBoundingClientRect())}>
          <Rocket size={22} strokeWidth={2.5} />
          Publish on BeatStars
        </button>
        <button className={styles.browser} onClick={onOpenBrowser}>
          <ExternalLink size={16} strokeWidth={2.5} />
          Open in browser
        </button>
        <ConfirmButton className={styles.stop} onConfirm={onStop} confirmLabel="Click again to stop">
          Stop here, don't publish
        </ConfirmButton>
      </div>
    </Card>
  )
}
