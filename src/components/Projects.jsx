import { useNavigate } from 'react-router-dom'

const projects = [
  {
    id: 'accretion',
    title: 'Black Hole Accretion Simulator',
    tag: 'Three.js / Physics / Interactive',
    description: 'A real-time 3D simulation of particle dynamics around a black hole. Particles orbit, spiral inward, and get absorbed by the event horizon. Fully interactive — spawn and launch particles with the mouse.',
    status: 'live',
    path: '/projects/accretion'
  },
  {
    id: 'exoplanet',
    title: 'Exoplanet Detection',
    tag: 'Python / NASA Data / ML',
    description: 'Using real Kepler telescope data to detect exoplanets via the transit method — the same technique used by actual astronomers.',
    status: 'coming'
  },
  {
    id: 'gravitational-waves',
    title: 'Gravitational Wave Analyser',
    tag: 'Python / LIGO Data / Signal Processing',
    description: 'Analysing real LIGO data to identify gravitational wave signals from black hole and neutron star mergers.',
    status: 'coming'
  }
]

export default function Projects() {
  const navigate = useNavigate()

  return (
    <section id="projects" style={{
      background: '#000',
      padding: '120px 40px',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      <p style={{
        color: 'rgba(255,255,255,0.25)',
        fontFamily: 'monospace',
        fontSize: '11px',
        letterSpacing: '4px',
        textTransform: 'uppercase',
        marginBottom: '64px'
      }}>Projects</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {projects.map((proj, i) => (
          <div
            key={proj.id}
            onClick={() => {
              if (proj.status === 'coming') return
              if (proj.path) navigate(proj.path)
              else if (proj.link) window.open(proj.link, '_blank')
            }}
            style={{
              padding: '40px 0',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              cursor: proj.status === 'coming' ? 'default' : 'pointer',
              opacity: proj.status === 'coming' ? 0.4 : 1,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={e => {
              if (proj.status !== 'coming') e.currentTarget.style.opacity = '0.7'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = proj.status === 'coming' ? '0.4' : '1'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px'
            }}>
              <div>
                <span style={{
                  color: 'rgba(255,255,255,0.25)',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  marginRight: '16px'
                }}>0{i + 1}</span>
                <span style={{
                  color: '#fff',
                  fontFamily: 'Georgia, serif',
                  fontSize: 'clamp(18px, 2.5vw, 26px)',
                  fontWeight: 300
                }}>{proj.title}</span>
              </div>
              <span style={{
                color: 'rgba(255,255,255,0.25)',
                fontFamily: 'monospace',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginTop: '6px',
                whiteSpace: 'nowrap',
                marginLeft: '20px'
              }}>
                {proj.status === 'coming' ? 'In Progress' : 'View'}
              </span>
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '12px'
            }}>{proj.tag}</p>
            <p style={{
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(13px, 1.5vw, 15px)',
              lineHeight: 1.8,
              maxWidth: '600px',
              fontWeight: 300
            }}>{proj.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}