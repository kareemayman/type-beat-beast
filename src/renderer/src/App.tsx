// Placeholder screen until the Claude Design mockups arrive.
const DEMO_BPM = 140

export default function App() {
  const { electron, chrome, node } = window.api.versions

  return (
    <main className="placeholder">
      <span className="led" style={{ animationDuration: `${60 / DEMO_BPM}s` }} aria-hidden />
      <h1>Type Beat Beast</h1>
      <p className="tagline">The studio is warming up. Screens coming soon.</p>
      <p className="versions">
        Electron {electron} · Chrome {chrome} · Node {node}
      </p>
    </main>
  )
}
