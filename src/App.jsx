import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

export default function App() {
  const mountRef = useRef(null)

  useEffect(() => {
    // --- Scene Setup ---
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000)
    // Slightly above the disk plane so we get a nice angled view
    camera.position.set(0, 50, 400)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    // Reinhard tone mapping keeps bloom from blowing out to pure white
    renderer.toneMapping = THREE.ReinhardToneMapping
    renderer.toneMappingExposure = 2.0
    mountRef.current.appendChild(renderer.domElement)

    // Left click spawns particles, right click rotates camera, middle pans
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.mouseButtons = {
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE
    }

    // --- Black Hole ---
    // Pure black sphere — acts as an occluder so particles behind it are hidden
    // This is what creates the shadow effect without needing any special shader
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

    // Yellow arrow that appears while dragging to show launch direction and speed
    const arrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0, 0xffff00, 4, 2
    )
    arrowHelper.visible = false
    scene.add(arrowHelper)

    // Invisible plane used for raycasting mouse clicks into world space
    const spawnPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10000, 10000),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    spawnPlane.rotation.x = -Math.PI / 2
    scene.add(spawnPlane)

    const spawnRaycaster = new THREE.Raycaster()

    // --- Physics Constants ---
    // G and BLACK_HOLE_MASS are scaled for the simulation units, not real SI values
    const G = 50000
    const BLACK_HOLE_MASS = 100000
    const particles = []

    // --- Particle Spawning ---
    function spawnParticle(worldPos, velocity) {
      let x, y, z, vx, vy, vz
      const isUserSpawned = worldPos !== null

      if (!isUserSpawned) {
        // Place particle randomly in a flat disk around the black hole
        // Initial velocity is circular orbital speed: v = sqrt(GM/r)
        // This gives stable orbits at any radius without needing to tune anything
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
        // User spawned — use the position and velocity from mouse input
        x = worldPos.x
        y = worldPos.y
        z = worldPos.z
        vx = velocity.x
        vy = velocity.y
        vz = velocity.z
      }

      // User particles are yellow and slightly larger so they stand out from the disk
      const size = isUserSpawned ? 3 : Math.random() * 0.7 + 0.3
      const color = isUserSpawned ? 0xffff00 : 0xffffff
      const geo = new THREE.SphereGeometry(size, 8, 8)
      const mat = new THREE.MeshBasicMaterial({ color })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      scene.add(mesh)

      // Each particle gets a trail so you can see the orbital path it takes
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
    // Projects a screen click to a 3D world position at the same depth as the black hole
    // Uses the camera distance to origin so it works at any zoom level
    function mouseToWorld(event) {
      const ndcX = (event.clientX / window.innerWidth) * 2 - 1
      const ndcY = -(event.clientY / window.innerHeight) * 2 + 1
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

      // Wait for 5px of movement before treating it as a drag
      // Prevents accidental drags when just clicking
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
        // Drag — the drag vector becomes the launch velocity
        // Multiplied by 50 to match the simulation's velocity scale
        const currentWorld = mouseToWorld(e)
        const velocity = currentWorld.clone().sub(dragStartWorld).multiplyScalar(50)
        spawnParticle(dragStartWorld, velocity)
      } else {
        // Click — spawn stationary particle, gravity pulls it straight in
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
    // UnrealBloomPass makes bright fast-moving particles glow
    // Simulates the intense radiation emitted by infalling matter
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5,  // intensity
      0.2,  // radius
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

        // Remove particle if it crosses the event horizon
        if (dist < 28) {
          p.active = false
          scene.remove(p.mesh)
          scene.remove(p.trail)
          continue
        }

        // Newtonian gravity: F = GMm/r², direction toward black hole
        const forceMag = G * BLACK_HOLE_MASS * p.mass / (dist * dist)
        const acc = pos.clone().normalize().multiplyScalar(-forceMag / p.mass)
        p.velocity.addScaledVector(acc, dt)
        p.mesh.position.addScaledVector(p.velocity, dt)

        // Keep a rolling buffer of the last 60 positions for the trail
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

        // Faster particles are hotter so they glow brighter
        // Keep user spawned particles yellow so they're always visible
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
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      composer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      mountRef.current?.removeChild(renderer.domElement)
      renderer.dispose()
      composer.dispose()
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
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
    </div>
  )
}