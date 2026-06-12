import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { useNavigate } from 'react-router-dom'

export default function AccretionPage() {
  const mountRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth
    const H = mount.clientHeight

    // --- Scene Setup ---
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
      RIGHT: THREE.MOUSE.ROTATE
    }

    // --- Black Hole ---
    // Pure black sphere — acts as an occluder so particles behind it are hidden
    const blackHoleGeo = new THREE.SphereGeometry(28, 64, 64)
    const blackHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const blackHole = new THREE.Mesh(blackHoleGeo, blackHoleMat)
    scene.add(blackHole)

    // --- Star Field ---
    // Kept very dim so it doesn't compete with the bloom effect
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

    // Yellow arrow shown while dragging to preview launch direction
    const arrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0, 0xffff00, 4, 2
    )
    arrowHelper.visible = false
    scene.add(arrowHelper)

    // Invisible plane for raycasting mouse clicks into world space
    const spawnPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10000, 10000),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    spawnPlane.rotation.x = -Math.PI / 2
    scene.add(spawnPlane)

    // --- Physics Constants ---
    // G and BLACK_HOLE_MASS are scaled for simulation units, not real SI values
    const G = 50000
    const BLACK_HOLE_MASS = 100000
    const particles = []

    // --- Particle Spawning ---
    function spawnParticle(worldPos, velocity) {
      let x, y, z, vx, vy, vz
      const isUserSpawned = worldPos !== null

      if (!isUserSpawned) {
        // Random disk particle — circular orbital speed v = sqrt(GM/r) gives stable orbits
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * 90 + 35
        x = Math.cos(angle) * distance
        y = (Math.random() - 0.5) * 6
        z = Math.sin(angle) * distance
        const speed = Math.sqrt(G * BLACK_HOLE_MASS / distance)
        vx = -Math.sin(angle) * speed
        vy = (Math.random() - 0.5) * speed * 0.01
        vz = Math.cos(angle) * speed
      } else {
        // User spawned — position and velocity come from mouse input
        x = worldPos.x
        y = worldPos.y
        z = worldPos.z
        vx = velocity.x
        vy = velocity.y
        vz = velocity.z
      }

      // User particles are yellow and larger so they stand out from the disk
      const size = isUserSpawned ? 3 : Math.random() * 0.7 + 0.3
      const color = isUserSpawned ? 0xffff00 : 0xffffff
      const geo = new THREE.SphereGeometry(size, 8, 8)
      const mat = new THREE.MeshBasicMaterial({ color })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      scene.add(mesh)

      // Trail shows the orbital path each particle takes
      const trailGeo = new THREE.BufferGeometry()
      const trailPositions = new Float32Array(60 * 3)
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
      trailGeo.setDrawRange(0, 0)
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
        color: isUserSpawned ? 0xffff00 : 0xffffff,
        transparent: true,
        opacity: 0.4
      }))
      scene.add(trail)

      particles.push({
        mesh, trail, trailPoints: [],
        velocity: new THREE.Vector3(vx, vy, vz),
        mass: Math.random() * 2 + 1,
        active: true,
        isUserSpawned
      })
    }

    // Populate the initial accretion disk
    for (let i = 0; i < 300; i++) spawnParticle(null, null)

    // --- Mouse to World Conversion ---
    // Projects a screen click to 3D world space at the same depth as the black hole
    function mouseToWorld(event) {
      const ndcX = (event.clientX / mount.clientWidth) * 2 - 1
      const ndcY = -(event.clientY / mount.clientHeight) * 2 + 1
      const vector = new THREE.Vector3(ndcX, ndcY, 0.5)
      vector.unproject(camera)
      const dir = vector.sub(camera.position).normalize()
      const distToOrigin = camera.position.length()
      return camera.position.clone().add(dir.multiplyScalar(distToOrigin))
    }

    // --- Mouse Interaction ---
    let isDragging = false
    let dragStart = null
    let dragStartWorld = null

    function onMouseDown(e) {
      if (e.button !== 0) return
      isDragging = false
      dragStart = { x: e.clientX, y: e.clientY }
      dragStartWorld = mouseToWorld(e)
    }

    function onMouseMove(e) {
      if (!dragStart || !dragStartWorld) return
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y

      // Only treat as drag after 5px movement — avoids accidental drags on clicks
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        isDragging = true
        const currentWorld = mouseToWorld(e)
        const dir = currentWorld.clone().sub(dragStartWorld)
        const length = dir.length()
        if (length > 0) {
          arrowHelper.visible = true
          arrowHelper.position.copy(dragStartWorld)
          arrowHelper.setDirection(dir.clone().normalize())
          arrowHelper.setLength(length, 4, 2)
        }
      }
    }

    function onMouseUp(e) {
      if (e.button !== 0 || !dragStart || !dragStartWorld) return

      if (isDragging) {
        // Drag vector becomes launch velocity — multiplied by 50 to match simulation scale
        const currentWorld = mouseToWorld(e)
        const velocity = currentWorld.clone().sub(dragStartWorld).multiplyScalar(50)
        spawnParticle(dragStartWorld, velocity)
      } else {
        // Click — spawn stationary, gravity pulls it straight in
        spawnParticle(dragStartWorld, new THREE.Vector3(0, 0, 0))
      }

      arrowHelper.visible = false
      dragStart = null
      dragStartWorld = null
      isDragging = false
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // --- Post Processing ---
    // UnrealBloomPass makes fast particles glow — simulates radiation from infalling matter
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(W, H),
      0.4,  // intensity
      0.1,  // radius
      0.2   // luminance threshold
    ))

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate)
      const dt = 0.0008

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (!p.active) continue

        const pos = p.mesh.position
        const dist = pos.length()

        // Absorb particle when it crosses the event horizon
        if (dist < 28) {
          p.active = false
          scene.remove(p.mesh)
          scene.remove(p.trail)
          continue
        }

        // Newtonian gravity: F = GMm/r², pointing toward black hole
        const forceMag = G * BLACK_HOLE_MASS * p.mass / (dist * dist)
        const acc = pos.clone().normalize().multiplyScalar(-forceMag / p.mass)
        p.velocity.addScaledVector(acc, dt)
        p.mesh.position.addScaledVector(p.velocity, dt)

        // Rolling buffer of last 60 positions for the trail
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

        // Faster particles are hotter — keep user particles yellow
        if (!p.isUserSpawned) {
          const spd = p.velocity.length()
          const t = Math.min(spd / 20, 1)
          p.mesh.material.color.setScalar(Math.max(0.5, 0.3 + t * 0.7))
        }
      }

      controls.update()
      composer.render()
    }

    animate()

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
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      composer.dispose()
    }
  }, [])

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#000' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', top: 16, left: 16,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'monospace', fontSize: 13,
        pointerEvents: 'none'
      }}>
        <div>LEFT CLICK — spawn stationary particle</div>
        <div>LEFT DRAG — launch with velocity</div>
        <div>RIGHT DRAG — rotate camera</div>
        <div>SCROLL — zoom</div>
      </div>
      <div
        onClick={() => navigate('/')}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'monospace',
          fontSize: '12px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          cursor: 'pointer',
          zIndex: 10
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
      >
        Back
      </div>
    </div>
  )
}