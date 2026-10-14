import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

// Physics constants — scaled for simulation units, not real SI values
const G = 50000
const BLACK_HOLE_MASS = 100000
const BASE_HORIZON = 28 // Schwarzschild radius (Rs) at mass x1
const BASE_DT = 0.0008
const MAX_PARTICLES = 1500

const EXPERIMENTS = {
  fall: {
    label: 'Fall in',
    text: 'Dropped from rest, so it has no sideways speed to keep it away. Gravity pulls it straight into the horizon.',
  },
  circular: {
    label: 'Circular orbit',
    text: 'Launched sideways at exactly v = sqrt(GM/r). Gravity bends its path into a circle, so it never gets closer or further.',
  },
  escape: {
    label: 'Escape',
    text: 'Launched at 1.1 x the escape speed, v = sqrt(2GM/r). It is climbing out faster than gravity can slow it, so it never comes back.',
  },
  ellipse: {
    label: 'Elliptical orbit',
    text: 'Launched sideways at 80% of circular speed. Too slow to stay circular, so it swings in close and back out again.',
  },
}

const hud = {
  position: 'absolute',
  fontFamily: 'monospace',
  fontSize: 12,
  color: 'rgba(255,255,255,0.75)',
  background: 'rgba(0,0,0,0.55)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '10px 12px',
  lineHeight: 1.6,
}

const button = (active) => ({
  fontFamily: 'monospace',
  fontSize: 12,
  color: active ? '#000' : 'rgba(255,255,255,0.8)',
  background: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 4,
  padding: '5px 10px',
  cursor: 'pointer',
})

const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—')

export default function App() {
  const mountRef = useRef(null)
  const api = useRef(null)
  const [info, setInfo] = useState({ active: 0, swallowed: 0, tracked: null, drag: null, mass: 1, solved: 0 })
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [mass, setMass] = useState(1)
  const [trails, setTrails] = useState(true)
  const [rings, setRings] = useState(true)
  const [showLearn, setShowLearn] = useState(true)
  const [lesson, setLesson] = useState(null)
  const [grow, setGrow] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth
    const H = mount.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 10000)
    camera.position.set(0, 50, 400)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(W, H)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.toneMapping = THREE.ReinhardToneMapping
    renderer.toneMappingExposure = 2.0
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.mouseButtons = {
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }

    // Black hole — pure black sphere acts as occluder, creating the shadow effect.
    // Built at unit horizon radius and scaled, because Rs grows linearly with mass.
    const blackHole = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    )
    scene.add(blackHole)

    // Reference circles from General Relativity: horizon (1 Rs), photon sphere (1.5 Rs), ISCO (3 Rs)
    const ringGroup = new THREE.Group()
    const makeRing = (radiusInRs, color) => {
      const pts = []
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(a) * radiusInRs, 0, Math.sin(a) * radiusInRs))
      }
      return new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
      )
    }
    ringGroup.add(makeRing(1.5, 0xffb347))
    ringGroup.add(makeRing(3, 0x4fd1c5))
    scene.add(ringGroup)

    // Star field — kept dim so it doesn't compete with the bloom
    const starsGeo = new THREE.BufferGeometry()
    const starPositions = []
    for (let i = 0; i < 3000; i++) {
      starPositions.push(
        (Math.random() - 0.5) * 6000,
        (Math.random() - 0.5) * 6000,
        (Math.random() - 0.5) * 6000
      )
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0x888888, size: 0.8 })))

    // Arrow shown while dragging to preview launch direction and speed
    const arrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0, 0xffff00, 4, 2
    )
    arrowHelper.visible = false
    scene.add(arrowHelper)

    const params = { paused: false, speed: 1, mass: 1, trails: true, grow: false }
    const particles = []
    let swallowed = 0
    let tracked = null
    let solved = 0

    const GM = () => G * BLACK_HOLE_MASS * params.mass
    const horizon = () => BASE_HORIZON * params.mass

    function applyMass() {
      const r = horizon()
      blackHole.scale.setScalar(r)
      ringGroup.scale.setScalar(r)
    }
    applyMass()

    function removeParticle(p) {
      scene.remove(p.mesh)
      scene.remove(p.trail)
      p.mesh.geometry.dispose()
      p.mesh.material.dispose()
      p.trail.geometry.dispose()
      p.trail.material.dispose()
    }

    function spawnParticle(worldPos, velocity, opts = {}) {
      if (particles.filter(p => p.active).length >= MAX_PARTICLES) return null
      const isUserSpawned = worldPos !== null
      let x, y, z, vx, vy, vz

      if (!isUserSpawned) {
        // Circular orbital speed v = sqrt(GM/r) gives stable orbits at any radius
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * 90 + 35 * params.mass
        x = Math.cos(angle) * distance
        y = (Math.random() - 0.5) * 6
        z = Math.sin(angle) * distance
        const speed = Math.sqrt(GM() / distance)
        vx = -Math.sin(angle) * speed
        vy = (Math.random() - 0.5) * speed * 0.01
        vz = Math.cos(angle) * speed
      } else {
        x = worldPos.x; y = worldPos.y; z = worldPos.z
        vx = velocity.x; vy = velocity.y; vz = velocity.z
      }

      const size = opts.size ?? (isUserSpawned ? 3 : Math.random() * 0.7 + 0.3)
      const color = isUserSpawned ? 0xffff00 : 0xffffff
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 8),
        new THREE.MeshBasicMaterial({ color })
      )
      mesh.position.set(x, y, z)
      scene.add(mesh)

      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3))
      trailGeo.setDrawRange(0, 0)
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
        color: opts.color ?? color,
        transparent: true,
        opacity: 0.4,
      }))
      trail.visible = params.trails
      scene.add(trail)

      const p = {
        mesh, trail, trailPoints: [],
        velocity: new THREE.Vector3(vx, vy, vz),
        active: true,
        isUserSpawned,
        age: 0,
        orbits: 0,
        lastAngle: Math.atan2(z, x),
      }
      particles.push(p)
      return p
    }

    function track(p) {
      if (tracked && tracked !== p && tracked.isUserSpawned) tracked.mesh.material.color.set(0xffff00)
      tracked = p
      if (p) p.mesh.material.color.set(0x4fd1c5)
    }

    function addDisk(n) {
      for (let i = 0; i < n; i++) spawnParticle(null, null)
    }

    function clearAll() {
      particles.forEach(removeParticle)
      particles.length = 0
      tracked = null
      swallowed = 0
    }

    function meteorShower() {
      // Come in from far away with a random sideways offset (impact parameter):
      // small offsets get captured, large ones whip past and leave.
      for (let i = 0; i < 40; i++) {
        const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.2, Math.random() - 0.5).normalize()
        const pos = dir.clone().multiplyScalar(350)
        const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
        const target = side.multiplyScalar((Math.random() - 0.5) * 220)
        const vel = target.sub(pos).normalize().multiplyScalar(Math.sqrt(GM() / 350) * 1.1)
        spawnParticle(pos, vel, { color: 0xff8a65 })
      }
    }

    // A star is a tight clump on a plunging orbit. Gravity pulls harder on its near side than its far side,
    // so the clump is stretched into a stream: tidal disruption ("spaghettification").
    function sendStar() {
      const dir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.1, Math.random() - 0.5).normalize()
      const r = 260 * params.mass
      const centre = dir.clone().multiplyScalar(r)
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
      const aim = side.multiplyScalar(horizon() * 1.2)
      const vel = aim.sub(centre).normalize().multiplyScalar(Math.sqrt(GM() / r) * 0.9)
      for (let i = 0; i < 60; i++) {
        const jitter = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14)
        spawnParticle(centre.clone().add(jitter), vel.clone(), { color: 0xffd54f, size: 1.4 })
      }
      camera.position.copy(centre.clone().multiplyScalar(1.3)).setY(120)
    }

    function experiment(kind) {
      const r = 150 * params.mass
      const pos = new THREE.Vector3(r, 0, 0)
      const vc = Math.sqrt(GM() / r)
      const dir = new THREE.Vector3(0, 0, 1)
      let vel
      if (kind === 'fall') vel = new THREE.Vector3()
      else if (kind === 'circular') vel = dir.multiplyScalar(vc)
      else if (kind === 'escape') vel = dir.multiplyScalar(vc * Math.SQRT2 * 1.1)
      else vel = dir.multiplyScalar(vc * 0.8)
      const p = spawnParticle(pos, vel)
      if (p) {
        // Camera looks down on the orbital plane so the shape of the path is easy to read
        camera.position.set(0, 450 * params.mass, 150)
        track(p)
      }
    }

    function mouseToWorld(event) {
      const rect = mount.getBoundingClientRect()
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1
      const vector = new THREE.Vector3(ndcX, ndcY, 0.5)
      vector.unproject(camera)
      const dir = vector.sub(camera.position).normalize()
      const distToOrigin = camera.position.length()
      return camera.position.clone().add(dir.multiplyScalar(distToOrigin))
    }

    // Live numbers for a drag: how fast, compared with the speeds that matter at that radius
    function launchInfo(startWorld, velocity) {
      const r = startWorld.length()
      const gm = GM()
      return {
        speed: velocity.length(),
        circular: Math.sqrt(gm / r),
        escape: Math.sqrt((2 * gm) / r),
      }
    }

    let isDragging = false
    let dragStart = null
    let dragStartWorld = null
    let dragInfo = null

    const overHud = e => e.target.closest && e.target.closest('[data-hud]')

    function onMouseDown(e) {
      if (e.button !== 0 || overHud(e)) return
      isDragging = false
      dragStart = { x: e.clientX, y: e.clientY }
      dragStartWorld = mouseToWorld(e)
    }

    function onMouseMove(e) {
      if (!dragStart || !dragStartWorld) return
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        isDragging = true
        const currentWorld = mouseToWorld(e)
        const dir = currentWorld.clone().sub(dragStartWorld)
        const length = dir.length()
        if (length > 0) {
          const li = launchInfo(dragStartWorld, dir.clone().multiplyScalar(50))
          dragInfo = li
          // Green = bound orbit, yellow = near circular, red = will escape
          const col = li.speed >= li.escape ? 0xff5555 : Math.abs(li.speed / li.circular - 1) < 0.1 ? 0x4fd1c5 : 0xffff00
          arrowHelper.visible = true
          arrowHelper.position.copy(dragStartWorld)
          arrowHelper.setDirection(dir.clone().normalize())
          arrowHelper.setLength(length, 4, 2)
          arrowHelper.setColor(col)
        }
      }
    }

    function onMouseUp(e) {
      if (e.button !== 0 || !dragStart || !dragStartWorld) return
      let p
      if (isDragging) {
        const currentWorld = mouseToWorld(e)
        const velocity = currentWorld.clone().sub(dragStartWorld).multiplyScalar(50)
        p = spawnParticle(dragStartWorld, velocity)
      } else {
        p = spawnParticle(dragStartWorld, new THREE.Vector3(0, 0, 0))
      }
      if (p) track(p)
      arrowHelper.visible = false
      dragStart = null
      dragStartWorld = null
      isDragging = false
      dragInfo = null
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.2, 0.2))

    addDisk(300)

    function step(dt) {
      const gm = GM()
      const rh = horizon()
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (!p.active) continue
        const pos = p.mesh.position
        const dist = pos.length()

        if (dist < rh) {
          p.active = false
          p.endedAfter = p.age
          swallowed++
          if (params.grow) { params.mass += 0.004; applyMass() }
          scene.remove(p.mesh)
          scene.remove(p.trail)
          continue
        }

        // Newton: a = GM / r^2 toward the centre (the particle's own mass cancels out)
        p.velocity.addScaledVector(pos.clone().normalize(), -(gm / (dist * dist)) * dt)
        pos.addScaledVector(p.velocity, dt)
        p.age += dt

        if (p === tracked) {
          const a = Math.atan2(pos.z, pos.x)
          let d = a - p.lastAngle
          if (d > Math.PI) d -= Math.PI * 2
          if (d < -Math.PI) d += Math.PI * 2
          p.orbits += Math.abs(d) / (Math.PI * 2)
          p.lastAngle = a
        }
      }
    }

    function describe(p) {
      if (!p) return null
      const gm = GM()
      const rh = horizon()
      if (!p.active) {
        return { gone: true, text: `Swallowed after ${fmt(p.endedAfter * 1000, 0)} time units and ${fmt(p.orbits, 2)} orbits.` }
      }
      const pos = p.mesh.position
      const r = pos.length()
      const v = p.velocity.length()
      const energy = (v * v) / 2 - gm / r
      const h = new THREE.Vector3().crossVectors(pos, p.velocity).length()
      const ecc = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (gm * gm)))
      const periapsis = (h * h) / (gm * (1 + ecc))
      let verdict
      if (energy >= 0 && periapsis > rh && p.velocity.dot(pos) > 0) verdict = 'Escaping: it has more than escape speed and is moving away.'
      else if (periapsis <= rh) verdict = 'On a collision course: its closest approach is inside the horizon.'
      else if (energy >= 0) verdict = 'Flyby: it will swing past once, then leave.'
      else if (ecc < 0.1) verdict = 'Stable, nearly circular orbit.'
      else verdict = 'Bound elliptical orbit: it keeps looping back.'
      return {
        gone: false,
        r: r / rh,
        v, circular: Math.sqrt(gm / r), escape: Math.sqrt((2 * gm) / r),
        clock: Math.sqrt(Math.max(0, 1 - rh / r)),
        ecc, orbits: p.orbits, verdict,
      }
    }

    const animate = () => {
      requestAnimationFrame(animate)

      if (!params.paused) {
        const sub = Math.ceil(params.speed)
        for (let s = 0; s < sub; s++) step((BASE_DT * params.speed) / sub)
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (!p.active) continue
        p.trail.visible = params.trails
        if (params.paused) continue
        p.trailPoints.push(p.mesh.position.clone())
        if (p.trailPoints.length > 60) p.trailPoints.shift()
        const positions = p.trail.geometry.attributes.position.array
        for (let j = 0; j < p.trailPoints.length; j++) {
          positions[j * 3] = p.trailPoints[j].x
          positions[j * 3 + 1] = p.trailPoints[j].y
          positions[j * 3 + 2] = p.trailPoints[j].z
        }
        p.trail.geometry.attributes.position.needsUpdate = true
        p.trail.geometry.setDrawRange(0, p.trailPoints.length)

        if (!p.isUserSpawned) {
          const t = Math.min(p.velocity.length() / 20, 1)
          // Gravitational redshift: light from deep in the well loses energy and looks redder and dimmer
          const red = Math.min(1, Math.max(0, (horizon() * 3) / p.mesh.position.length() - 0.6))
          const b = Math.max(0.5, 0.3 + t * 0.7)
          p.mesh.material.color.setRGB(b, b * (1 - red * 0.8), b * (1 - red))
        }
      }

      controls.update()
      composer.render()
    }
    animate()

    const timer = setInterval(() => {
      const desc = describe(tracked)
      // Challenge: three orbits, nearly circular, without falling in
      if (desc && !desc.gone && !tracked.solved && tracked.orbits >= 3 && desc.ecc < 0.15) {
        tracked.solved = true
        solved++
      }
      setInfo({
        mass: params.mass, solved,
        active: particles.filter(p => p.active).length,
        swallowed,
        tracked: desc,
        drag: dragInfo,
      })
    }, 150)

    api.current = {
      setPaused: v => { params.paused = v },
      setSpeed: v => { params.speed = v },
      setMass: v => { params.mass = v; applyMass() },
      setTrails: v => { params.trails = v },
      setRings: v => { ringGroup.visible = v },
      setGrow: v => { params.grow = v },
      addDisk, clearAll, meteorShower, experiment, sendStar,
      reset: () => { clearAll(); addDisk(300) },
    }

    const handleResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      composer.dispose()
    }
  }, [])

  const t = info.tracked
  const d = info.drag

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#000' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      <div style={{ ...hud, top: 16, left: 16, pointerEvents: 'none', maxWidth: 270 }}>
        <div>LEFT CLICK — drop a particle</div>
        <div>LEFT DRAG — launch it (arrow colour: <span style={{ color: '#4fd1c5' }}>circular</span> / <span style={{ color: '#ff5555' }}>escapes</span>)</div>
        <div>RIGHT DRAG — rotate · SCROLL — zoom</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ color: '#ffb347' }}>●</span> photon sphere 1.5 Rs · <span style={{ color: '#4fd1c5' }}>●</span> ISCO 3 Rs
        </div>
        <div style={{ opacity: 0.55 }}>Rings are General Relativity markers; the physics here is Newtonian.</div>
      </div>

      {d && (
        <div data-hud style={{ ...hud, top: 16, left: '50%', transform: 'translateX(-50%)' }}>
          launch speed {fmt(d.speed, 0)} · circular {fmt(d.circular, 0)} · escape {fmt(d.escape, 0)}
          {' — '}
          {d.speed >= d.escape ? 'will escape' : Math.abs(d.speed / d.circular - 1) < 0.1 ? 'near-circular orbit' : d.speed < d.circular ? 'too slow to stay circular' : 'elliptical orbit'}
        </div>
      )}

      <div data-hud style={{ ...hud, top: 16, right: 16, width: 300 }}>
        <div style={{ color: '#fff', marginBottom: 4 }}>
          Tracked particle <span style={{ opacity: 0.5 }}>(your last launch)</span>
        </div>
        {!t && <div style={{ opacity: 0.6 }}>Click or drag in space to launch one, or run an experiment below.</div>}
        {t && t.gone && <div>{t.text}</div>}
        {t && !t.gone && (
          <>
            <div>distance {fmt(t.r, 2)} Rs</div>
            <div>speed {fmt(t.v, 0)} (circular {fmt(t.circular, 0)}, escape {fmt(t.escape, 0)})</div>
            <div>eccentricity {fmt(t.ecc, 2)} · orbits {fmt(t.orbits, 2)}</div>
            <div>its clock runs at {fmt(t.clock * 100, 0)}% of a far-away clock</div>
            <div style={{ color: '#4fd1c5', marginTop: 4 }}>{t.verdict}</div>
          </>
        )}
        <div style={{ marginTop: 8, opacity: 0.55 }}>
          {info.active} in flight · {info.swallowed} swallowed
          <div>Challenge: 3 near-circular orbits without falling in · solved {info.solved}</div>
        </div>
      </div>

      {showLearn && (
        <div data-hud style={{ ...hud, top: 190, right: 16, width: 300 }}>
          <div style={{ color: '#fff', marginBottom: 4 }}>
            {lesson ? EXPERIMENTS[lesson].label : 'What you are seeing'}
          </div>
          {lesson ? (
            <div>{EXPERIMENTS[lesson].text}</div>
          ) : (
            <>
              <div>Gravity pulls with a = GM / r². Closer means stronger.</div>
              <div>Orbiting speed is v = √(GM/r): closer in, faster round.</div>
              <div>Escape speed is √2 times that. Beat it and you never return.</div>
              <div>The horizon radius Rs grows in proportion to mass. Try the mass slider.</div>
              <div>Send a star and watch tides stretch it into a stream. Near the hole, clocks run slow and light turns red.</div>
            </>
          )}
        </div>
      )}

      <div data-hud style={{
        ...hud, bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', maxWidth: '94vw',
      }}>
        <span style={{ opacity: 0.55 }}>Experiments</span>
        {Object.entries(EXPERIMENTS).map(([k, e]) => (
          <button key={k} style={button(lesson === k)} onClick={() => { setLesson(k); api.current.experiment(k) }}>{e.label}</button>
        ))}
        <span style={{ opacity: 0.3 }}>|</span>
        <button style={button(false)} onClick={() => api.current.meteorShower()}>Meteor shower</button>
        <button style={button(false)} onClick={() => api.current.sendStar()}>Send a star</button>
        <button style={button(false)} onClick={() => api.current.addDisk(100)}>+100 disk</button>
        <button style={button(false)} onClick={() => { setLesson(null); api.current.reset() }}>Reset</button>
        <button style={button(false)} onClick={() => api.current.clearAll()}>Clear</button>
        <span style={{ opacity: 0.3 }}>|</span>
        <button style={button(paused)} onClick={() => { api.current.setPaused(!paused); setPaused(!paused) }}>{paused ? 'Play' : 'Pause'}</button>
        <label>speed {speed}x{' '}
          <input type="range" min="0.25" max="4" step="0.25" value={speed}
            onChange={e => { setSpeed(+e.target.value); api.current.setSpeed(+e.target.value) }} />
        </label>
        <label>mass {fmt(grow ? info.mass : mass, 2)}x{' '}
          <input type="range" min="0.5" max="3" step="0.25" value={grow ? Math.min(3, info.mass) : mass}
            onChange={e => { setMass(+e.target.value); api.current.setMass(+e.target.value) }} />
        </label>
        <button style={button(grow)} onClick={() => { api.current.setGrow(!grow); setGrow(!grow) }}>Hole grows</button>
        <button style={button(trails)} onClick={() => { api.current.setTrails(!trails); setTrails(!trails) }}>Trails</button>
        <button style={button(rings)} onClick={() => { api.current.setRings(!rings); setRings(!rings) }}>Rings</button>
        <button style={button(showLearn)} onClick={() => setShowLearn(!showLearn)}>Learn</button>
      </div>
    </div>
  )
}
