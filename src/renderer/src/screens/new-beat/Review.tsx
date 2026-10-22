import { Check, ExternalLink, FileArchive, FileAudio, Rocket, type LucideIcon } from 'lucide-react'
import { beatStarsTitle } from '../../../../shared/beatstars'
import Card from '../../components/Card'
import ConfirmButton from '../../components/ConfirmButton'
import { longKey, type Beat } from '../../lib/beat'
import styles from './Review.module.css'

interface ReviewProps {
  beat: Beat
  freeDownload: boolean
  onPublish(button: DOMRect): void
  onOpenBrowser(): void
  onStop(): void
}

// "Your turn": BeatStars is filled in and waits for the user's OK before anything goes public. "Matched" means the
// app read the value back from BeatStars' form (src/main/beatstarsUpload.ts). Collaborators aren't filled in yet.
export default function Review({ beat, freeDownload, onPublish, onOpenBrowser, onStop }: ReviewProps) {
  const rows: { label: string; value: string; byHand?: boolean }[] = [
    { label: 'Title', value: beatStarsTitle(beat.name) ?? beat.name },
    { label: 'BPM', value: beat.bpm },
    { label: 'Key', value: longKey(beat.key) },
    ...(beat.collabs.length ? beat.collabs.map((name) => ({ label: 'Collab', value: name, byHand: true })) : [{ label: 'Collab', value: 'Solo beat' }]),
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
          {beat.collabs.length ? "It's saved as a draft, nothing is public yet. Add the collabs in the Chrome window first." : "It's filled in and saved as a draft. Nothing is public yet."}
        </div>
        <div className={styles.rows}>
          {rows.map(({ label, value, byHand }, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.label}>{label}</span>
              <span className={styles.value}>{value || '—'}</span>
              {byHand ? (
                <span className={styles.flag} data-off="true">
                  Add by hand
                </span>
              ) : (
                <span className={styles.flag}>
                  <Check size={14} strokeWidth={3} />
                  Matched
                </span>
              )}
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
