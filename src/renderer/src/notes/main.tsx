import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/caveat/700.css'
import '../styles/tokens.css'
import { SettingsProvider } from '../lib/settings'
import Notes from './Notes'

// The Notes window's page (notes.html): a second, small React app with its own root, sharing the main app's
// styles, components and settings.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <Notes />
    </SettingsProvider>
  </StrictMode>,
)
