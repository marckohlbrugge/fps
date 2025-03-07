import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export class GunEffects {
  constructor(scene, audioContext) {
    this.scene = scene;
    this.audioContext = audioContext;
  }

  // Create muzzle flash effect
  createMuzzleFlash(position, direction) {
    // Create a point light for the muzzle flash
    const flashLight = new THREE.PointLight(0xffff00, 2, 5);
    flashLight.position.copy(position);
    this.scene.add(flashLight);

    // Create a small mesh for the visual flash
    const flashGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    flash.userData.createdAt = performance.now();
    flash.userData.lifespan = 50; // Very short lifespan

    // Add to scene
    this.scene.add(flash);

    // Store in global particles array if it exists
    if (!window.particles) window.particles = [];
    window.particles.push(flash);

    // Remove light after a short delay
    setTimeout(() => {
      this.scene.remove(flashLight);
    }, 50);
  }

  // Create impact effect when bullets hit surfaces
  createImpactEffect(position, normal, hitObject, particleCount = 5) {
    // Check if we hit a bunny
    if (hitObject && hitObject.userData && hitObject.userData.isBunny) {
      this.createBloodParticles(position);
      return;
    }

    // Create particles
    if (!window.particles) {
      window.particles = [];
    }

    // Determine particle color based on hit object or floor
    let color = 0xbbbbbb; // Default gray

    if (hitObject === null && normal.y > 0.9) {
      // We hit the floor - use dirt/ground color
      color = 0x8B4513; // Saddle brown for dirt
    } else if (hitObject && hitObject.material && hitObject.material.color) {
      // Use the color of the hit object
      color = hitObject.material.color.getHex();
    }

    for (let i = 0; i < particleCount; i++) {
      // Create particle
      const size = 0.05 + Math.random() * 0.05;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });

      const particle = new THREE.Mesh(geometry, material);

      // Position at impact point
      particle.position.copy(position);

      // Add slight offset to avoid z-fighting
      particle.position.add(normal.clone().multiplyScalar(0.05));

      // Set velocity - mostly along normal but with some randomness
      const velocity = new THREE.Vector3(
        normal.x + (Math.random() - 0.5) * 0.5,
        normal.y + (Math.random() - 0.5) * 0.5 + 0.5, // Add upward bias
        normal.z + (Math.random() - 0.5) * 0.5
      ).normalize().multiplyScalar(1 + Math.random() * 2);

      particle.userData.velocity = velocity;
      particle.userData.createdAt = performance.now();
      particle.userData.lifespan = 1000 + Math.random() * 1000; // 1-2 seconds

      this.scene.add(particle);
      window.particles.push(particle);
    }

    // Create impact mark on surfaces (except floor for performance)
    if (hitObject && normal.y < 0.9) {
      this.createImpactMark(position, normal, hitObject);
    }
  }

  // Create impact mark (bullet hole)
  createImpactMark(position, normal, hitObject) {
    // Skip if no hit object or if it's not a wall
    if (!hitObject || hitObject.userData.isAnimal) return;

    // Create a small decal for the bullet hole
    const markSize = 0.1;
    const markGeometry = new THREE.CircleGeometry(markSize, 8);
    const markMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });

    const mark = new THREE.Mesh(markGeometry, markMaterial);

    // Position the mark slightly above the surface to prevent z-fighting
    const offset = 0.01;
    mark.position.copy(position).addScaledVector(normal, offset);

    // Orient the mark to face the normal direction
    mark.lookAt(position.clone().add(normal));

    // Store reference to parent object for cleanup
    mark.userData.parentObject = hitObject;
    mark.userData.createdAt = performance.now();
    mark.userData.lifespan = 30000; // 30 seconds

    this.scene.add(mark);

    // Add to global impact markers array for cleanup
    if (!window.impactMarkers) window.impactMarkers = [];
    window.impactMarkers.push(mark);
  }

  // Create explosion effect
  createExplosion(position, radius, force) {
    // Create explosion light
    const explosionLight = new THREE.PointLight(0xff7700, 2, radius * 3);
    explosionLight.position.copy(position);
    this.scene.add(explosionLight);

    // Check if this is a ground explosion
    const isGroundExplosion = position.y < 0.5;

    // Create dirt explosion if hitting ground
    if (isGroundExplosion) {
      this.createDirtExplosion(position, radius);
      // Move explosion position slightly up for better visuals
      position.y = 0.5;
    }

    // Create explosion particles
    const explosionGeometry = new THREE.BufferGeometry();
    const explosionTexture = this.createExplosionTexture();

    // Create particles in a sphere
    const particleCount = 100;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Random position in sphere
      const radius = Math.random() * 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i3] = position.x + radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = position.y + radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = position.z + radius * Math.cos(phi);

      // For ground explosions, keep particles above ground
      if (positions[i3 + 1] < 0.05) {
        positions[i3 + 1] = 0.05 + Math.random() * 0.1;
      }

      // Color gradient from white/yellow center to red/orange edges
      const colorFactor = Math.random();
      colors[i3] = 1.0; // R
      colors[i3 + 1] = 0.5 + (1 - colorFactor) * 0.5; // G
      colors[i3 + 2] = colorFactor < 0.3 ? 0.5 - colorFactor : 0; // B

      // Random sizes
      sizes[i] = 2 + Math.random() * 3;
    }

    explosionGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    explosionGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    explosionGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Remove light after a short delay
    setTimeout(() => {
      this.scene.remove(explosionLight);
    }, 100);

    // Play explosion sound
    this.playSound('explosion');
  }

  // Create dirt explosion for ground impacts
  createDirtExplosion(position, radius) {
    // Create dirt particles
    const particleCount = 50;
    const colors = [0x8B4513, 0x654321, 0x5D4037, 0x3E2723]; // Different dirt browns

    if (!window.particles) {
      window.particles = [];
    }

    for (let i = 0; i < particleCount; i++) {
      // Create particle
      const size = 0.1 + Math.random() * 0.2;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.9
      });

      const particle = new THREE.Mesh(geometry, material);

      // Position at impact point, slightly above ground
      particle.position.set(
        position.x + (Math.random() - 0.5) * radius * 0.5,
        0.05 + Math.random() * 0.1,
        position.z + (Math.random() - 0.5) * radius * 0.5
      );

      // Set velocity - mostly upward with outward spread
      const angle = Math.random() * Math.PI * 2;
      const height = 2 + Math.random() * 3; // Higher dirt plume
      const spread = 1 + Math.random() * 2;

      const velocity = new THREE.Vector3(
        Math.cos(angle) * spread,
        height,
        Math.sin(angle) * spread
      );

      particle.userData.velocity = velocity;
      particle.userData.createdAt = performance.now();
      particle.userData.lifespan = 1500 + Math.random() * 1000; // 1.5-2.5 seconds
      particle.userData.isDirt = true; // Mark as dirt for special physics

      this.scene.add(particle);
      window.particles.push(particle);
    }
  }

  // Create explosion texture
  createExplosionTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;

    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,128,1)');
    gradient.addColorStop(0.4, 'rgba(255,128,0,1)');
    gradient.addColorStop(0.6, 'rgba(255,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Play sound effects
  playSound(type) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    switch (type) {
      case 'shoot_translocator':
        // Translocator shoot sound - high-tech, energetic
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
        break;

      case 'translocator_transition':
        // Translocator transition sound - ascending pitch
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
        break;

      case 'translocator_teleport':
        // Translocator teleport sound - sci-fi whoosh
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);
        break;

      case 'shoot_sniper':
        // Sniper rifle sound - lower pitch, longer duration
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
        break;

      case 'shoot_pistol':
        // Pistol sound - sharp, quick
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;

      case 'shoot_akimbo':
        // Akimbo sound - similar to pistol but slightly different
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.35, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;

      case 'explosion':
        // Explosion sound - low frequency boom
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(10, this.audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
        break;

      case 'shoot_gatling':
        // Gatling gun sound - rapid, metallic
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.05);
        break;

      default:
        // Generic shooting sound for any unhandled types
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(160, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;
    }
  }

  // Create scorch mark on the ground
  createScorchMark(position, radius) {
    // Create a circular scorch mark on the ground
    const scorchGeometry = new THREE.CircleGeometry(radius * 0.7, 16);
    const scorchMaterial = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });

    const scorch = new THREE.Mesh(scorchGeometry, scorchMaterial);
    scorch.rotation.x = -Math.PI / 2; // Flat on ground
    scorch.position.set(position.x, 0.01, position.z); // Just above ground

    scorch.userData.createdAt = performance.now();
    scorch.userData.lifespan = 10000; // 10 seconds
    scorch.userData.isGroundMark = true;

    this.scene.add(scorch);

    // Add to global particles array for updating
    if (!window.particles) window.particles = [];
    window.particles.push(scorch);
  }

  // Create lingering smoke cloud
  createSmokeCloud(position, radius) {
    const smokeCount = 20;
    const smokeGeometry = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeSizes = new Float32Array(smokeCount);

    for (let i = 0; i < smokeCount; i++) {
      const i3 = i * 3;
      const smokeRadius = Math.random() * radius * 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      smokePositions[i3] = position.x + smokeRadius * Math.sin(phi) * Math.cos(theta);
      smokePositions[i3 + 1] = position.y + smokeRadius * Math.sin(phi) * Math.sin(theta) + radius * 0.3;
      smokePositions[i3 + 2] = position.z + smokeRadius * Math.cos(phi);

      smokeSizes[i] = radius * (0.5 + Math.random() * 0.5);
    }

    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeometry.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1));

    const smokeMaterial = new THREE.PointsMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.4,
      size: 1,
      sizeAttenuation: true,
      depthWrite: false
    });

    const smoke = new THREE.Points(smokeGeometry, smokeMaterial);
    smoke.userData.createdAt = performance.now();
    smoke.userData.lifespan = 2000; // 2 seconds
    smoke.userData.isSmoke = true;

    this.scene.add(smoke);

    // Add to global particles array
    if (!window.particles) window.particles = [];
    window.particles.push(smoke);
  }

  // Enhanced explosion effect for Bazooka
  createEnhancedExplosion(position, radius, force) {
    // Create explosion light with shorter duration
    const explosionLight = new THREE.PointLight(0xff7700, 5, radius * 3);
    explosionLight.position.copy(position);
    this.scene.add(explosionLight);

    // Remove light after a short delay
    setTimeout(() => {
      this.scene.remove(explosionLight);
    }, 300);

    // Create explosion particles
    const particleCount = 200; // More particles for better visibility
    const explosionGeometry = new THREE.BufferGeometry();

    // Create particles in a sphere
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Random position in sphere
      const particleRadius = Math.random() * radius;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i3] = position.x + particleRadius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = position.y + particleRadius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = position.z + particleRadius * Math.cos(phi);

      // For ground explosions, keep particles above ground
      if (positions[i3 + 1] < 0.05) {
        positions[i3 + 1] = 0.05 + Math.random() * 0.1;
      }

      // Color gradient from white/yellow center to red/orange edges
      const colorFactor = Math.random();
      colors[i3] = 1.0; // R
      colors[i3 + 1] = 0.5 + (1 - colorFactor) * 0.5; // G
      colors[i3 + 2] = colorFactor < 0.3 ? 0.5 - colorFactor : 0; // B

      // Random sizes
      sizes[i] = 3 + Math.random() * 5; // Larger particles
    }

    explosionGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    explosionGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    explosionGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create particle material with custom texture
    const explosionMaterial = new THREE.PointsMaterial({
      size: 1,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    // Create explosion mesh
    const explosion = new THREE.Points(explosionGeometry, explosionMaterial);
    explosion.userData.createdAt = performance.now();
    explosion.userData.lifespan = 800; // Shorter lifespan
    explosion.userData.velocities = [];

    // Add velocity to each particle
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const direction = new THREE.Vector3(
        positions[i3] - position.x,
        positions[i3 + 1] - position.y,
        positions[i3 + 2] - position.z
      ).normalize();

      // Random speed
      const speed = 2 + Math.random() * 5;
      explosion.userData.velocities.push(direction.multiplyScalar(speed));
    }

    // Add to scene
    this.scene.add(explosion);

    // Add to global particles array for updating
    if (!window.particles) window.particles = [];
    window.particles.push(explosion);

    // Play explosion sound
    this.playSound('explosion');

    // Create ground scorch mark if explosion is near ground
    if (position.y < radius) {
      this.createScorchMark(position, radius);
    }

    // Create smoke cloud that lingers
    this.createSmokeCloud(position, radius);
  }

  // Create trail particle for translocator projectile
  createTranslocatorTrailParticle(position) {
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8
    });

    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(position);

    // Add random offset for more interesting trail
    particle.position.x += (Math.random() - 0.5) * 0.1;
    particle.position.y += (Math.random() - 0.5) * 0.1;
    particle.position.z += (Math.random() - 0.5) * 0.1;

    // Add properties for animation
    particle.userData.createdAt = performance.now();
    particle.userData.lifespan = 500; // Half second lifespan
    particle.userData.initialScale = particle.scale.clone();

    this.scene.add(particle);

    // Add to global particles array
    if (!window.particles) window.particles = [];
    window.particles.push(particle);

    return particle;
  }

  // Create teleport effect
  createTeleportEffect(position) {
    // Create a flash of light
    const teleportLight = new THREE.PointLight(0x00ffff, 5, 10);
    teleportLight.position.copy(position);
    this.scene.add(teleportLight);

    // Create expanding ring effect
    const ringGeometry = new THREE.RingGeometry(0, 2, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2; // Lay flat

    this.scene.add(ring);

    // Animate the ring
    ring.userData.createdAt = performance.now();
    ring.userData.lifespan = 500; // Half second animation
    ring.userData.initialScale = ring.scale.clone();

    // Add to global particles array
    if (!window.particles) window.particles = [];
    window.particles.push(ring);

    // Remove light after a short delay
    setTimeout(() => {
      this.scene.remove(teleportLight);
    }, 500);

    // Play teleport sound
    this.playSound('translocator_teleport');
  }

  // Generate teleport sound
  generateTeleportSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.2);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    filter.Q.setValueAtTime(10, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  // Create bullet trail effect
  createBulletTrail(bullet, color = 0xff6600) {
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: color,
      opacity: 0.5,
      transparent: true
    });

    const trailPositions = new Float32Array(2 * 3); // 2 points, 3 coordinates each
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    bullet.userData.trail = trail;
    this.scene.add(trail);
    return trail;
  }

  // Create blood particles when hitting animals/enemies
  createBloodParticles(position) {
    if (!window.particles) {
      window.particles = [];
    }

    // Create blood particles
    const particleCount = 15;
    const colors = [0x8B0000, 0x800000, 0x8B0000]; // Different shades of dark red

    for (let i = 0; i < particleCount; i++) {
      // Create particle
      const size = 0.05 + Math.random() * 0.05;
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.9
      });

      const particle = new THREE.Mesh(geometry, material);

      // Position at impact point
      particle.position.copy(position);

      // Add random offset
      particle.position.x += (Math.random() - 0.5) * 0.2;
      particle.position.y += (Math.random() - 0.5) * 0.2;
      particle.position.z += (Math.random() - 0.5) * 0.2;

      // Set velocity - spread outward from impact point
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2, // Upward bias
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(2 + Math.random() * 2);

      particle.userData.velocity = velocity;
      particle.userData.createdAt = performance.now();
      particle.userData.lifespan = 500 + Math.random() * 500; // 0.5-1 second
      particle.userData.isBlood = true;

      this.scene.add(particle);
      window.particles.push(particle);
    }

    // Create blood splatter decal on nearby surfaces
    this.createBloodSplatter(position);
  }

  // Create blood splatter decal
  createBloodSplatter(position) {
    // Create a circular blood splatter
    const size = 0.2 + Math.random() * 0.3;
    const splatterGeometry = new THREE.CircleGeometry(size, 8);
    const splatterMaterial = new THREE.MeshBasicMaterial({
      color: 0x8B0000,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });

    const splatter = new THREE.Mesh(splatterGeometry, splatterMaterial);

    // Find nearby surfaces to place the splatter
    const raycaster = new THREE.Raycaster();
    const directions = [
      new THREE.Vector3(0, -1, 0), // Down
      new THREE.Vector3(1, 0, 0),  // Right
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(0, 0, 1),  // Forward
      new THREE.Vector3(0, 0, -1)  // Back
    ];

    for (const direction of directions) {
      raycaster.set(position, direction);
      const intersects = raycaster.intersectObjects(window.walls || []);

      if (intersects.length > 0 && intersects[0].distance < 1) {
        // Create a splatter on this surface
        const splatClone = splatter.clone();
        splatClone.position.copy(intersects[0].point);
        splatClone.lookAt(intersects[0].point.clone().add(intersects[0].face.normal));

        // Add random rotation
        splatClone.rotation.z = Math.random() * Math.PI * 2;

        // Add properties for cleanup
        splatClone.userData.createdAt = performance.now();
        splatClone.userData.lifespan = 10000; // 10 seconds
        splatClone.userData.isBloodSplatter = true;

        this.scene.add(splatClone);
        if (!window.particles) window.particles = [];
        window.particles.push(splatClone);
      }
    }
  }
} 