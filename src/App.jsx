import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function App() {
  const mountRef = useRef(null)

  useEffect(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000)
    camera.position.set(0, 200, 400)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    mountRef.current.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const blackHoleGeo = new THREE.SphereGeometry(20, 32, 32)
    const blackHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const blackHole = new THREE.Mesh(blackHoleGeo, blackHoleMat)
    scene.add(blackHole)

    const ambientLight = new THREE.AmbientLight(0xffffff, 2)
    scene.add(ambientLight)

    const starsGeo = new THREE.BufferGeometry()
    const starPositions = []
    for (let i = 0; i < 2000; i++) {
      starPositions.push(
        (Math.random() - 0.5) * 4000,
        (Math.random() - 0.5) * 4000,
        (Math.random() - 0.5) * 4000
      )
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5 })
    const stars = new THREE.Points(starsGeo, starsMat)
    scene.add(stars)

    const ringGeo = new THREE.RingGeometry(22, 35, 64)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 3
    scene.add(ring)

    const PARTICLE_COUNT = 300
    const G = 50000
    const BLACK_HOLE_MASS = 100000
    const particles = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * 120 + 50
      const spread = (Math.random() - 0.5) * 150

      const x = Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      const y = spread

      const speed = Math.sqrt(G * BLACK_HOLE_MASS / distance)
      const vx = -Math.sin(angle) * speed
      const vz = Math.cos(angle) * speed

      const geo = new THREE.SphereGeometry(Math.random() * 1.5 + 0.5, 8, 8)
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.1, 1, 0.9)
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      scene.add(mesh)

      particles.push({
        mesh,
        velocity: new THREE.Vector3(vx, (Math.random() - 0.5) * speed * 0.3, vz),
        mass: Math.random() * 2 + 1,
        active: true
      })
    }

    const animate = () => {
      requestAnimationFrame(animate)
      const dt = 0.0008

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (!p.active) continue

        const pos = p.mesh.position
        const dist = pos.length()

        if (dist < 22) {
          p.active = false
          scene.remove(p.mesh)
          continue
        }

        // Black hole gravity
        const forceMag = G * BLACK_HOLE_MASS * p.mass / (dist * dist)
        const force = pos.clone().normalize().multiplyScalar(-forceMag)
        const acc = force.clone().divideScalar(p.mass)
        p.velocity.addScaledVector(acc, dt)
        p.mesh.position.addScaledVector(p.velocity, dt)

        // Collision detection
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          if (!q.active) continue

          const diff = p.mesh.position.clone().sub(q.mesh.position)
          const collisionDist = p.mesh.geometry.parameters.radius + q.mesh.geometry.parameters.radius

          if (diff.length() < collisionDist * 2) {
            const totalMass = p.mass + q.mass

            p.velocity.multiplyScalar(p.mass)
            p.velocity.addScaledVector(q.velocity, q.mass)
            p.velocity.divideScalar(totalMass)

            p.mesh.position.addScaledVector(q.mesh.position, q.mass / totalMass)

            p.mass = totalMass
            const newRadius = Math.cbrt(p.mass) * 1.2
            scene.remove(p.mesh)
            const newGeo = new THREE.SphereGeometry(newRadius, 8, 8)
            const newMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color().setHSL(0.08 + Math.random() * 0.1, 1, 0.9)
            })
            p.mesh = new THREE.Mesh(newGeo, newMat)
            p.mesh.position.copy(pos)
            scene.add(p.mesh)

            q.active = false
            scene.remove(q.mesh)
          }
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      mountRef.current?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh', background: '#000' }} />
}