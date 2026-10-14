# Black Hole Accretion Simulator

A real-time 3D gravitational simulation of particle dynamics around a black hole, built with Three.js and React.

Particles orbit the black hole under Newtonian gravity, spiral inward as they lose energy through interactions, and get absorbed when they cross the event horizon. The glowing accretion disk emerges naturally from the physics — no textures or fake effects.

## Physics

- Newtonian gravity: F = GMm/r², computed each frame for every particle
- Initial disk particles given circular orbital velocity v = sqrt(GM/r) for stable orbits
- Particle brightness scales with orbital speed — faster infalling matter radiates more
- Bloom post-processing simulates the intense radiation emitted by the accretion disk
- The black hole shadow is a pure black sphere acting as an occluder — no shader needed

## Learn by experimenting

- **Experiments** drop a tracked particle into a known situation: fall in, circular orbit, escape, elliptical orbit. A plain-English explanation appears with each.
- **Live readout** shows the tracked particle's distance in Schwarzschild radii, its speed against circular and escape speed, its eccentricity, and a verdict (stable orbit, flyby, escaping, collision course).
- **Launch preview**: while dragging, the arrow turns teal for a near-circular orbit and red if the launch will escape.
- **Send a star** drops a clump of 60 particles on a plunging orbit. Tides stretch it into a stream before it is swallowed.
- **Time dilation and redshift**: the tracked particle shows how slowly its clock runs against a far-away one, and particles turn red as they sink.
- **Hole grows** makes the horizon expand as it swallows matter.
- **Challenge**: get a tracked particle through three near-circular orbits without falling in.
- **Mass slider**: the event horizon radius grows in proportion to mass, and every orbit changes with it.
- **Reference rings** mark the photon sphere (1.5 Rs) and the innermost stable circular orbit (3 Rs). These come from General Relativity; the simulation itself is Newtonian, so particles can orbit inside the ISCO here even though real ones could not.

## Controls

| Input | Action |
|---|---|
| Left click | Drop a stationary particle: it falls straight in |
| Left drag | Launch a particle; arrow length and direction set the velocity |
| Right drag | Rotate camera |
| Scroll | Zoom |
| Panel buttons | Experiments, meteor shower, extra disk particles, pause, speed, mass, trails, rings |

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