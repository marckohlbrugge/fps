/**
 * Base Gun class that all weapon types extend
 */
export class Gun {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.mesh = null;
    this.bullets = [];
    this.canShoot = true;
    this.damage = 10; // Default damage value

    // Initialize audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Method to create the gun mesh
  create() {
    // Override in subclasses
  }

  // Method to update gun state
  update(delta) {
    // Override in subclasses
  }

  // Method to shoot
  shoot() {
    // Override in subclasses
  }

  // Method to handle bullet movement and collisions
  updateBullets(delta, walls) {
    const currentTime = performance.now();

    // Update each bullet
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      // Check if bullet should be removed
      if (currentTime - bullet.userData.createdAt > bullet.userData.lifespan || !bullet.userData.alive) {
        // Remove bullet and trail from scene
        this.scene.remove(bullet);
        if (bullet.userData.trail) {
          this.scene.remove(bullet.userData.trail);
        }
        this.bullets.splice(i, 1);
        continue;
      }

      // Move bullet
      const bulletSpeed = bullet.userData.velocity * delta;
      bullet.position.add(bullet.userData.direction.clone().multiplyScalar(bulletSpeed));

      // If it's a rocket, update its trail
      if (bullet.userData.isRocket) {
        this.updateRocketTrail(bullet, delta);
      } else if (bullet.userData.trail) {
        // Update regular bullet trail
        const positions = bullet.userData.trail.geometry.attributes.position.array;

        // Trail start position (bullet's current position)
        positions[0] = bullet.position.x;
        positions[1] = bullet.position.y;
        positions[2] = bullet.position.z;

        // Trail end position (bullet's position minus direction)
        const trailEnd = bullet.position.clone().sub(bullet.userData.direction.clone().multiplyScalar(0.5));
        positions[3] = trailEnd.x;
        positions[4] = trailEnd.y;
        positions[5] = trailEnd.z;

        bullet.userData.trail.geometry.attributes.position.needsUpdate = true;
      }

      // Check for bullet collisions with walls
      if (this.checkBulletCollisions(bullet, walls) && bullet.userData.isRocket) {
        // Create explosion for rockets
        this.createExplosion(bullet.position.clone(), bullet.userData.explosionRadius, bullet.userData.explosionForce);
      }
    }
  }

  // Check for bullet collisions
  checkBulletCollisions(bullet, walls) {
    // Create a raycaster for collision detection
    const raycaster = new THREE.Raycaster();
    raycaster.set(bullet.position, bullet.userData.direction);

    // Check for intersections with walls
    const intersects = raycaster.intersectObjects(walls);

    // If we hit something close enough, mark the bullet for removal
    if (intersects.length > 0 && intersects[0].distance < bullet.userData.velocity / 20) {
      bullet.userData.alive = false;

      // Get the hit object
      const hitObject = intersects[0].object;

      // Apply damage to the hit object if it has health
      if (hitObject.userData.health !== undefined) {
        this.applyDamage(hitObject, bullet.userData.damage);
      }

      // Create impact effect, passing the hit object
      this.createImpactEffect(intersects[0].point, intersects[0].face.normal, hitObject);

      return true; // Collision detected
    }

    // Check for intersections with bunnies
    if (window.bunnies) {
      for (const bunny of window.bunnies) {
        if (bunny.isDead) continue;

        // Create a sphere for the bunny
        const bunnyRadius = 1 * bunny.scale;
        const bunnySphere = new THREE.Sphere(bunny.mesh.position, bunnyRadius);

        // Check if bullet is inside bunny sphere
        if (bunnySphere.containsPoint(bullet.position)) {
          bullet.userData.alive = false;

          // Apply damage to bunny
          bunny.takeDamage(bullet.userData.damage);

          // Create impact effect
          this.createImpactEffect(
            bullet.position.clone(),
            bullet.userData.direction.clone().negate(),
            bunny.mesh
          );

          console.log("Hit a bunny!");
          return true; // Collision detected
        }
      }
    }

    // Check for floor collision
    if (bullet.position.y <= 0.05) { // Slightly above ground to account for floating point errors
      bullet.userData.alive = false;

      // Create impact effect for floor
      const floorNormal = new THREE.Vector3(0, 1, 0); // Floor normal points up
      this.createImpactEffect(
        new THREE.Vector3(bullet.position.x, 0, bullet.position.z), // Position on floor
        floorNormal,
        null // No specific hit object
      );

      // If it's a rocket, create an explosion
      if (bullet.userData.isRocket) {
        console.log("Rocket hit the ground!");
        return true; // Signal to create explosion
      }

      return true; // Collision detected
    }

    return false; // No collision
  }

  // Apply damage to an object
  applyDamage(object, damage) {
    object.userData.health -= damage;
    console.log(`Hit object! Damage: ${damage}, Remaining health: ${object.userData.health}`);

    // If health is depleted, handle destruction
    if (object.userData.health <= 0) {
      this.destroyObject(object);
    }
  }

  // Handle object destruction
  destroyObject(object) {
    // Create destruction effect
    this.createDestructionEffect(object.position);

    // Remove all impact markers (bullet holes) associated with this object
    this.removeImpactMarkers(object);

    // Remove the object from the scene
    this.scene.remove(object);

    // Remove from walls array if it's there
    // Check if walls is defined as a global variable
    if (window.walls) {
      const wallIndex = window.walls.indexOf(object);
      if (wallIndex !== -1) {
        window.walls.splice(wallIndex, 1);
        console.log("Wall destroyed and removed from collision detection!");
      }
    } else {
      // Try to find the walls array in the global scope
      console.log("Wall destroyed, but couldn't access walls array directly.");
      // Signal to the main script that this object should be removed from collision detection
      object.userData.destroyed = true;
    }
  }

  // Remove all impact markers associated with an object
  removeImpactMarkers(object) {
    // If we don't have a global array of impact markers yet, create one
    if (!window.impactMarkers) {
      window.impactMarkers = [];
      return;
    }

    // Find all impact markers associated with this object and remove them
    for (let i = window.impactMarkers.length - 1; i >= 0; i--) {
      const marker = window.impactMarkers[i];
      if (marker.userData.parentObject === object) {
        this.scene.remove(marker);
        window.impactMarkers.splice(i, 1);
      }
    }
  }

  // Create destruction effect
  createDestructionEffect(position) {
    // Create particle explosion
    const particleCount = 20;
    const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xbbbbbb,
      transparent: true,
      opacity: 0.8
    });

    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.copy(position);

      // Add random offset
      particle.position.x += (Math.random() - 0.5) * 2;
      particle.position.y += (Math.random() - 0.5) * 2;
      particle.position.z += (Math.random() - 0.5) * 2;

      // Add random velocity
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5 + 5, // Upward bias
        (Math.random() - 0.5) * 5
      ).normalize().multiplyScalar(1 + Math.random() * 2);

      particle.userData.createdAt = performance.now();
      particle.userData.lifespan = 1000 + Math.random() * 1000; // 1-2 seconds

      this.scene.add(particle);

      // Add to a global array for updating
      if (!window.particles) window.particles = [];
      window.particles.push(particle);
    }

    // Play explosion sound
    this.playSound('explosion');
  }

  // Method to generate and play a sound
  playSound(type) {
    // Different sound types
    switch (type) {
      case 'shoot':
        this.generateShootSound();
        break;
      case 'impact':
        this.generateImpactSound();
        break;
      case 'explosion':
        this.generateExplosionSound();
        break;
    }
  }

  // Generate shooting sound
  generateShootSound() {
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Set parameters
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(55, this.audioContext.currentTime + 0.1);

    // Volume envelope
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    // Play and stop
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Generate impact sound
  generateImpactSound() {
    // Create oscillator and noise
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Set parameters for impact sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.3);

    // Volume envelope
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

    // Play and stop
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  // Add explosion sound
  generateExplosionSound() {
    // Create noise burst
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    // Connect nodes
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Set parameters
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.5);

    // Volume envelope
    gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

    // Play and stop
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.5);
  }

  // Create impact effect
  createImpactEffect(position, normal, hitObject) {
    // Check if we hit a bunny
    if (hitObject && hitObject.userData && hitObject.userData.isBunny) {
      // Create red blood particles for bunny hit
      this.createBloodParticles(position);
      return;
    }

    // Create particles
    if (!window.particles) {
      window.particles = [];
    }

    // Number of particles based on gun type
    const particleCount = 5; // Default value, will be overridden in GatlingGun subclass

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

  // Create blood particles for bunny hits
  createBloodParticles(position) {
    if (!window.particles) {
      window.particles = [];
    }

    // Create more particles for blood
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      // Create particle
      const size = 0.03 + Math.random() * 0.05;
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Red blood
        transparent: true,
        opacity: 0.9
      });

      const particle = new THREE.Mesh(geometry, material);

      // Position at impact point
      particle.position.copy(position);

      // Set velocity - spray in all directions
      const angle = Math.random() * Math.PI * 2;
      const height = Math.random() * 0.5 + 0.2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * (Math.random() * 2 + 1),
        height,
        Math.sin(angle) * (Math.random() * 2 + 1)
      );

      particle.userData.velocity = velocity;
      particle.userData.createdAt = performance.now();
      particle.userData.lifespan = 800 + Math.random() * 800; // 0.8-1.6 seconds

      this.scene.add(particle);
      window.particles.push(particle);
    }
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

    // Create dirt ring on ground
    const ringRadius = radius * 0.8;
    const ringGeometry = new THREE.CircleGeometry(ringRadius, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x5D4037, // Dark brown
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2; // Lay flat on ground
    ring.position.set(position.x, 0.01, position.z); // Just above ground

    this.scene.add(ring);

    // Add to particles for cleanup
    ring.userData.createdAt = performance.now();
    ring.userData.lifespan = 10000; // 10 seconds
    ring.userData.isGroundMark = true;

    window.particles.push(ring);
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
      if (isGroundExplosion && positions[i3 + 1] < 0.05) {
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

    // Apply explosion damage to objects
    this.applyExplosionDamage(position, radius, force);

    // Remove light after a short delay
    setTimeout(() => {
      this.scene.remove(explosionLight);
    }, 100);
  }

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

  applyExplosionDamage(position, radius, force) {
    // Apply damage to walls
    if (window.walls) {
      for (const wall of window.walls) {
        if (wall.userData.destroyed) continue;

        // Get wall position
        const wallPos = new THREE.Vector3();
        wall.getWorldPosition(wallPos);

        // Calculate distance
        const distance = position.distanceTo(wallPos);

        // If within explosion radius, apply damage
        if (distance < radius) {
          // Damage falls off with distance
          const damageRatio = 1 - (distance / radius);
          const damage = this.damage * damageRatio;

          this.applyDamage(wall, damage);

          // Apply force to wall (if it has physics)
          if (wall.userData.applyForce) {
            const direction = wallPos.clone().sub(position).normalize();
            const forceAmount = force * damageRatio;
            wall.userData.applyForce(direction, forceAmount);
          }
        }
      }
    }

    // Apply damage to bunnies
    if (window.bunnies) {
      for (const bunny of window.bunnies) {
        if (bunny.isDead) continue;

        // Calculate distance
        const distance = position.distanceTo(bunny.mesh.position);

        // If within explosion radius, apply damage
        if (distance < radius) {
          // Damage falls off with distance
          const damageRatio = 1 - (distance / radius);
          const damage = this.damage * damageRatio;

          bunny.takeDamage(damage);

          // Apply force to bunny
          if (!bunny.isDead) {
            const direction = bunny.mesh.position.clone().sub(position).normalize();
            direction.y = 0.5; // Add upward component

            // Apply impulse to bunny
            bunny.velocity.add(direction.multiplyScalar(force * damageRatio));
          }
        }
      }
    }

    // Apply camera shake if player is close
    const distanceToPlayer = position.distanceTo(this.camera.position);
    if (distanceToPlayer < radius * 2) {
      const shakeAmount = (1 - distanceToPlayer / (radius * 2)) * 0.2;
      this.shakeCamera(shakeAmount);
    }
  }

  shakeCamera(intensity) {
    // Don't shake if intensity is too low
    if (intensity < 0.01) return;

    const originalPosition = this.camera.position.clone();
    const originalRotation = this.camera.rotation.clone();

    const shakeDuration = 300; // Shorter duration for better responsiveness
    const startTime = performance.now();

    // Flag to track if we're currently shaking
    if (!window.isShakingCamera) {
      window.isShakingCamera = true;
    } else {
      // Already shaking, just increase intensity
      return;
    }

    const shake = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / shakeDuration;

      if (progress < 1) {
        // Decreasing intensity over time
        const currentIntensity = intensity * (1 - progress);

        // Apply random offset to camera
        this.camera.position.x = originalPosition.x + (Math.random() - 0.5) * currentIntensity;
        this.camera.position.y = originalPosition.y + (Math.random() - 0.5) * currentIntensity;
        this.camera.position.z = originalPosition.z + (Math.random() - 0.5) * currentIntensity;

        // Apply slight rotation shake
        this.camera.rotation.x = originalRotation.x + (Math.random() - 0.5) * currentIntensity * 0.1;
        this.camera.rotation.y = originalRotation.y + (Math.random() - 0.5) * currentIntensity * 0.1;
        this.camera.rotation.z = originalRotation.z + (Math.random() - 0.5) * currentIntensity * 0.1;

        requestAnimationFrame(shake);
      } else {
        // Reset to original position
        this.camera.position.copy(originalPosition);
        this.camera.rotation.copy(originalRotation);

        // Reset the shaking flag
        window.isShakingCamera = false;
      }
    };

    shake();
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
} 