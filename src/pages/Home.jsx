import Hero from '../components/Hero'
import About from '../components/About'
import Projects from '../components/Projects'
import Contact from '../components/Contact'

export default function Home() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <Hero />
      <About />
      <Projects />
      <Contact />
    </div>
  )
}