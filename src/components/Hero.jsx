import { useEffect, useRef } from 'react'

export default function Hero() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Animated star field background
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      opacity: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.3 + 0.05
    }))

    let animFrame
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      stars.forEach(star => {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${star.opacity})`
        ctx.fill()
        star.opacity += (Math.random() - 0.5) * 0.02
        star.opacity = Math.max(0.1, Math.min(1, star.opacity))
      })
      animFrame = requestAnimationFrame(draw)
    }
    draw()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <section style={{
      position: 'relative',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#000'
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none'
      }} />
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'monospace',
          fontSize: '13px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          marginBottom: '20px'
        }}>
          Computer Science · Physics · Astrophysics
        </p>
        <h1 style={{
          color: '#fff',
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(40px, 7vw, 90px)',
          fontWeight: 300,
          letterSpacing: '2px',
          margin: '0 0 16px 0',
          lineHeight: 1.1
        }}>
          Karan Chugani
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'monospace',
          fontSize: 'clamp(13px, 1.5vw, 16px)',
          maxWidth: '500px',
          lineHeight: 1.7,
          margin: '0 auto 40px'
        }}>
          CS student at University of Leeds, building projects
          at the intersection of computation and the universe.
        </p>
        <a href="#projects" style={{
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'monospace',
          fontSize: '12px',
          letterSpacing: '3px',
          textDecoration: 'none',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          paddingBottom: '3px',
          transition: 'color 0.2s'
        }}
          onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.9)'}
          onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}
        >
          View Projects ↓
        </a>
      </div>
    </section>
  )
}