export default function Contact() {
  const linkStyle = {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
    fontSize: '12px',
    letterSpacing: '3px',
    textDecoration: 'none',
    textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.15)',
    paddingBottom: '3px'
  }

  return (
    <section id="contact" style={{ background: '#000', padding: '120px 40px', maxWidth: '700px', margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '32px' }}>
        Contact
      </p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Georgia, serif', fontSize: '17px', lineHeight: 1.9, marginBottom: '48px', fontWeight: 300 }}>
        Open to research collaborations, internships, and conversations about computational physics or applied mathematics.
      </p>
      <div style={{ display: 'flex', gap: '40px' }}>
        <a href="https://github.com/k4ranC" target="_blank" rel="noreferrer" style={linkStyle}>
          GitHub
        </a>
        <a href="mailto:karanchugani2005@icloud.com" style={linkStyle}>
          Email
        </a>
      </div>
    </section>
  )
}