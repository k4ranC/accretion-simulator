# Black Hole Accretion Simulator

A real-time 3D gravitational simulation of particle dynamics around a black hole, built with Three.js and React.

Particles orbit the black hole under Newtonian gravity, spiral inward as they lose energy through interactions, and get absorbed when they cross the event horizon. The glowing accretion disk emerges naturally from the physics — no textures or fake effects.

## Physics

- Newtonian gravity: F = GMm/r², computed each frame for every particle
- Initial disk particles given circular orbital velocity v = sqrt(GM/r) for stable orbits
- Particle brightness scales with orbital speed — faster infalling matter radiates more
- Bloom post-processing simulates the intense radiation emitted by the accretion disk
- The black hole shadow is a pure black sphere acting as an occluder — no shader needed

## Controls

| Input | Action |
|---|---|
| Left click | Spawn stationary particle — falls straight into the black hole |
| Left drag | Launch particle with custom velocity — direction and length set the trajectory |
| Right drag | Rotate camera |
| Scroll | Zoom |

## Running locally

```bash
npm install
npm run dev
```

## Built with

- Three.js — 3D rendering and physics
- React — component structure
- Vite — build tool
- UnrealBloomPass — glow post-processing