// Gun system for FPS game

class Gun {
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
    const particleCount = this instanceof GunSystem.GatlingGun ? 10 : 5;

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

    // Rest of the explosion code remains the same...
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

// Gatling Gun class
class GatlingGun extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.barrels = null;
    this.isSpinning = false;
    this.rotationSpeed = 0;
    this.maxRotationSpeed = 15;
    this.minFireSpeed = 3; // Minimum rotation speed needed to start firing
    this.optimalFireSpeed = 10; // Speed at which firing rate is optimal
    this.shootCooldown = 0.1; // Base cooldown between shots
    this.isMouseDown = false;
    this.spinUpTime = 3.0; // Increased to 3 seconds (was 1.5)
    this.spinUpRate = this.maxRotationSpeed / this.spinUpTime;
    this.damage = 10; // Gatling gun damage per bullet
  }

  create() {
    // Create a gun group
    this.mesh = new THREE.Group();

    // Create gun body
    const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    this.mesh.add(body);

    // Create gun barrels group (this will rotate)
    this.barrels = new THREE.Group();

    // Create 6 barrels arranged in a circle
    const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
    const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

    for (let i = 0; i < 6; i++) {
      const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
      // Position barrels in a circle around the center
      const angle = (i / 6) * Math.PI * 2;
      barrel.position.set(Math.sin(angle) * 0.08, Math.cos(angle) * 0.08, 0.25);
      barrel.rotation.x = Math.PI / 2;
      this.barrels.add(barrel);
    }

    // Add barrels to gun
    this.mesh.add(this.barrels);

    // Create gun handle
    const handleGeometry = new THREE.BoxGeometry(0.05, 0.15, 0.05);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.15;
    this.mesh.add(handle);

    // Position the gun in front of the camera
    this.mesh.position.set(0.3, -0.2, -0.5);
    this.camera.add(this.mesh);

    return this.mesh;
  }

  update(delta) {
    // Update gun barrel rotation
    if (this.isSpinning) {
      // When shooting button is held, increase rotation speed gradually
      if (this.isMouseDown) {
        // Gradual spin-up
        this.rotationSpeed = Math.min(
          this.rotationSpeed + this.spinUpRate * delta,
          this.maxRotationSpeed
        );
      } else {
        // When not shooting, slow down gradually
        this.rotationSpeed *= 0.97;

        // Stop spinning when slow enough
        if (this.rotationSpeed < 0.1) {
          this.isSpinning = false;
          this.rotationSpeed = 0;
        }
      }

      // Rotate the barrels
      this.barrels.rotation.z += this.rotationSpeed * delta;
    }
  }

  continuousFire() {
    if (this.isMouseDown) {
      // Only fire if the barrels are spinning fast enough
      if (this.canShoot && this.rotationSpeed >= this.minFireSpeed) {
        // Calculate fire rate based on rotation speed
        // Slower rotation = longer cooldown between shots
        const speedFactor = Math.min(1, (this.rotationSpeed - this.minFireSpeed) /
          (this.optimalFireSpeed - this.minFireSpeed));

        this.shoot();

        // Adjust cooldown based on rotation speed
        const adjustedCooldown = this.shootCooldown * (2 - speedFactor);

        // Set shooting cooldown
        this.canShoot = false;
        setTimeout(() => {
          this.canShoot = true;
          // Continue firing if still holding mouse
          if (this.isMouseDown && this.rotationSpeed >= this.minFireSpeed) {
            this.continuousFire();
          }
        }, adjustedCooldown * 1000);
      } else {
        // If barrels aren't spinning fast enough, check again soon
        requestAnimationFrame(() => this.continuousFire());
      }
    }
  }

  startFiring() {
    this.isMouseDown = true;
    this.isSpinning = true; // Start spinning immediately
    this.continuousFire(); // Start checking if we can fire
  }

  stopFiring() {
    this.isMouseDown = false;
  }

  shoot() {
    // Only shoot if we can
    if (!this.canShoot) return;

    // Play shooting sound
    this.playSound('shoot');

    // Create bullet geometry
    const bulletGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Bright yellow bullets
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Get current top barrel position
    const barrelIndex = Math.floor(this.barrels.rotation.z / (Math.PI * 2 / 6)) % 6;
    const barrelOffset = new THREE.Vector3(
      Math.sin(barrelIndex * Math.PI * 2 / 6) * 0.08,
      Math.cos(barrelIndex * Math.PI * 2 / 6) * 0.08,
      0.25
    );

    // Transform barrel offset to world coordinates
    const barrelTip = barrelOffset.clone();
    this.barrels.updateMatrixWorld(true);
    barrelTip.applyMatrix4(this.barrels.matrixWorld);

    // Set bullet position to start from the barrel
    bullet.position.copy(barrelTip);

    // Set bullet direction based on camera direction with slight spread
    const spread = 0.02; // Reduced spread for better accuracy
    const bulletDirection = new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      -1
    ).normalize();
    bulletDirection.applyQuaternion(this.camera.quaternion);
    bullet.userData.direction = bulletDirection;
    bullet.userData.velocity = 100; // Fast bullet
    bullet.userData.alive = true;
    bullet.userData.createdAt = performance.now();
    bullet.userData.lifespan = 2000; // 2 seconds
    bullet.userData.damage = this.damage;

    // Add bullet to scene and bullets array
    this.scene.add(bullet);
    this.bullets.push(bullet);

    // Add enhanced bullet trail
    this.createEnhancedBulletTrail(bullet, barrelTip);

    // Add muzzle flash
    this.createMuzzleFlash(barrelTip, bulletDirection);

    // Set shooting cooldown based on rotation speed
    const speedFactor = Math.min(1, Math.max(0, (this.rotationSpeed - this.minFireSpeed) / (this.optimalFireSpeed - this.minFireSpeed)));
    const currentCooldown = this.shootCooldown * (1 - speedFactor * 0.7); // Up to 70% faster at optimal speed

    this.canShoot = false;
    setTimeout(() => {
      this.canShoot = true;
    }, currentCooldown * 1000);
  }

  createEnhancedBulletTrail(bullet, startPosition) {
    // Create a more visible trail using a line
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineDashedMaterial({
      color: 0xffff00,
      dashSize: 0.05,
      gapSize: 0.05,
      opacity: 0.7,
      transparent: true
    });

    // Create trail with multiple segments for better visibility
    const segmentCount = 10;
    const positions = new Float32Array((segmentCount + 1) * 3);

    // Set all positions to start at the barrel
    for (let i = 0; i <= segmentCount; i++) {
      positions[i * 3] = startPosition.x;
      positions[i * 3 + 1] = startPosition.y;
      positions[i * 3 + 2] = startPosition.z;
    }

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.computeLineDistances(); // Required for dashed lines

    this.scene.add(trail);

    // Store trail data in bullet
    bullet.userData.trail = trail;
    bullet.userData.trailPositions = positions;
    bullet.userData.trailStartPosition = startPosition.clone();
    bullet.userData.trailSegments = segmentCount;

    return trail;
  }

  // Override updateBullets to handle the enhanced trails
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

      // Update enhanced trail if it exists
      if (bullet.userData.trail && bullet.userData.trailPositions) {
        this.updateEnhancedTrail(bullet, delta);
      }

      // Check for bullet collisions with walls
      this.checkBulletCollisions(bullet, walls);
    }
  }

  updateEnhancedTrail(bullet, delta) {
    const positions = bullet.userData.trailPositions;
    const segmentCount = bullet.userData.trailSegments;

    // Update trail positions - create a trail that stretches from barrel to current position
    const startPos = bullet.userData.trailStartPosition;
    const endPos = bullet.position;

    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount;

      // Interpolate between start and end positions
      positions[i * 3] = startPos.x + (endPos.x - startPos.x) * t;
      positions[i * 3 + 1] = startPos.y + (endPos.y - startPos.y) * t;
      positions[i * 3 + 2] = startPos.z + (endPos.z - startPos.z) * t;
    }

    // Update the trail geometry
    bullet.userData.trail.geometry.attributes.position.needsUpdate = true;
    bullet.userData.trail.computeLineDistances(); // Required for dashed lines

    // Fade out the trail over time
    const age = (performance.now() - bullet.userData.createdAt) / bullet.userData.lifespan;
    bullet.userData.trail.material.opacity = 0.7 * (1 - age);
  }

  // Add a custom shooting sound for the Gatling gun
  generateShootSound() {
    // Create oscillators for a more complex sound
    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Connect nodes
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Set parameters for a gatling gun sound
    oscillator1.type = 'square';
    oscillator1.frequency.setValueAtTime(220, this.audioContext.currentTime);
    oscillator1.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.05);

    oscillator2.type = 'sawtooth';
    oscillator2.frequency.setValueAtTime(440, this.audioContext.currentTime);
    oscillator2.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.05);

    // Volume envelope
    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

    // Play and stop
    oscillator1.start();
    oscillator2.start();
    oscillator1.stop(this.audioContext.currentTime + 0.05);
    oscillator2.stop(this.audioContext.currentTime + 0.05);
  }

  // Override the playSound method to use our custom sound
  playSound(type) {
    if (type === 'shoot') {
      this.generateShootSound();
    } else {
      // For other sound types (impact, explosion), use the parent class method
      super.playSound(type);
    }
  }
}

// Pistol class
class Pistol extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.shootCooldown = 0.5; // Medium fire rate
    this.damage = 25;
  }

  create() {
    // Create a gun group
    this.mesh = new THREE.Group();

    // Create gun body
    const bodyGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.25);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.mesh.add(body);

    // Create gun barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
    const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.2);
    this.mesh.add(barrel);

    // Create gun handle
    const handleGeometry = new THREE.BoxGeometry(0.06, 0.15, 0.05);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.12;
    this.mesh.add(handle);

    // Position the gun in front of the camera
    this.mesh.position.set(0.2, -0.15, -0.4);
    this.camera.add(this.mesh);

    return this.mesh;
  }

  update(delta) {
    // No special update needed for pistol
  }

  startFiring() {
    this.isMouseDown = true;
    this.continuousFire();
  }

  stopFiring() {
    this.isMouseDown = false;
  }

  continuousFire() {
    if (this.isMouseDown) {
      if (this.canShoot) {
        this.shoot();

        // Set shooting cooldown
        this.canShoot = false;
        setTimeout(() => {
          this.canShoot = true;
          // Continue firing if still holding mouse
          if (this.isMouseDown) {
            this.continuousFire();
          }
        }, this.shootCooldown * 1000);
      } else {
        // Check again after a short delay
        setTimeout(() => {
          if (this.isMouseDown) {
            this.continuousFire();
          }
        }, 10);
      }
    }
  }

  shoot() {
    // Only shoot if we can
    if (!this.canShoot) return;

    // Play shooting sound
    this.playSound('shoot');

    // Create bullet geometry
    const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 }); // Orange bullets for pistol
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Get barrel position
    const barrelTip = new THREE.Vector3(0, 0, 0.3);
    barrelTip.applyMatrix4(this.mesh.matrixWorld);

    // Set bullet position to start from the barrel
    bullet.position.copy(barrelTip);

    // Set bullet direction based on camera direction
    const bulletDirection = new THREE.Vector3(0, 0, -1);
    bulletDirection.applyQuaternion(this.camera.quaternion);
    bullet.userData.direction = bulletDirection;
    bullet.userData.velocity = 70; // Faster bullet speed
    bullet.userData.alive = true;
    bullet.userData.createdAt = performance.now();
    bullet.userData.lifespan = 2000; // Bullet lifespan in milliseconds
    bullet.userData.damage = this.damage; // Set bullet damage

    // Add bullet to scene and bullets array
    this.scene.add(bullet);
    this.bullets.push(bullet);

    // Add bullet trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff6600, opacity: 0.5, transparent: true });

    const trailPositions = new Float32Array(2 * 3); // 2 points, 3 coordinates each
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    bullet.userData.trail = trail;
    this.scene.add(trail);

    // Add recoil animation
    const originalPosition = this.mesh.position.clone();
    this.mesh.position.z += 0.05; // Move gun backward

    // Return to original position
    setTimeout(() => {
      this.mesh.position.copy(originalPosition);
    }, 100);
  }

  // Custom pistol sound
  generateShootSound() {
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Set parameters for a pistol sound
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, this.audioContext.currentTime + 0.1);

    // Volume envelope - sharper attack for pistol
    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    // Play and stop
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }
}

// Sniper Rifle class
class SniperRifle extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.shootCooldown = 1.2; // Very slow fire rate
    this.damage = 500; // Extremely high damage - one-shot kills walls
    this.isMouseDown = false;
    this.isZoomed = false;
    this.originalFOV = 75; // Set a fixed original FOV value
    this.zoomedFOV = 20; // Zoomed field of view
    this.zoomTransitionSpeed = 5; // Reduced for smoother transition
    this.targetFOV = this.originalFOV; // Current target FOV
    this.zoomEventAttached = false; // Track if zoom events are attached
    this.keyZoomActive = false; // Track if key zoom is active
  }

  create() {
    // Create a gun group
    this.mesh = new THREE.Group();

    // Create gun body - make it longer and more substantial
    const bodyGeometry = new THREE.BoxGeometry(0.05, 0.08, 0.7);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.mesh.add(body);

    // Add upper rail
    const railGeometry = new THREE.BoxGeometry(0.03, 0.02, 0.5);
    const railMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.set(0, 0.05, 0);
    this.mesh.add(rail);

    // Create scope - make it more visible and higher
    const scopeGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 16);
    const scopeMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const scope = new THREE.Mesh(scopeGeometry, scopeMaterial);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.09, 0.1); // Raised higher
    this.mesh.add(scope);

    // Add scope mounting brackets
    const bracketGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.02);
    const bracketMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // Front bracket
    const frontBracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
    frontBracket.position.set(0, 0.07, 0.03);
    this.mesh.add(frontBracket);

    // Rear bracket
    const rearBracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
    rearBracket.position.set(0, 0.07, 0.17);
    this.mesh.add(rearBracket);

    // Add scope lens (reflective material)
    const lensGeometry = new THREE.CircleGeometry(0.03, 16);
    const lensMaterial = new THREE.MeshPhongMaterial({
      color: 0x3333ff,
      shininess: 100,
      emissive: 0x222266
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(0, 0.09, 0.18);
    lens.rotation.y = Math.PI;
    this.mesh.add(lens);

    // Add scope adjustment knobs
    const knobGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8);
    const knobMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

    // Vertical adjustment knob
    const verticalKnob = new THREE.Mesh(knobGeometry, knobMaterial);
    verticalKnob.rotation.z = Math.PI / 2;
    verticalKnob.position.set(0, 0.09, 0.13);
    this.mesh.add(verticalKnob);

    // Horizontal adjustment knob
    const horizontalKnob = new THREE.Mesh(knobGeometry, knobMaterial);
    horizontalKnob.rotation.x = Math.PI / 2;
    horizontalKnob.position.set(0.04, 0.09, 0.1);
    this.mesh.add(horizontalKnob);

    // Create gun handle - make it more ergonomic
    const handleGeometry = new THREE.BoxGeometry(0.04, 0.15, 0.04);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.1;
    handle.position.z = 0.2;
    handle.rotation.x = 0.2; // Slight angle for better ergonomics
    this.mesh.add(handle);

    // Add trigger
    const triggerGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.01);
    const triggerMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const trigger = new THREE.Mesh(triggerGeometry, triggerMaterial);
    trigger.position.set(0, -0.05, 0.2);
    this.mesh.add(trigger);

    // Add trigger guard
    const guardGeometry = new THREE.TorusGeometry(0.03, 0.005, 8, 16, Math.PI);
    const guardMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.rotation.x = Math.PI / 2;
    guard.position.set(0, -0.07, 0.2);
    this.mesh.add(guard);

    // Add stock
    const stockGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.2);
    const stockMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const stock = new THREE.Mesh(stockGeometry, stockMaterial);
    stock.position.z = 0.45;
    stock.position.y = -0.02;
    this.mesh.add(stock);

    // Add stock cheek rest
    const cheekRestGeometry = new THREE.BoxGeometry(0.05, 0.03, 0.15);
    const cheekRestMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const cheekRest = new THREE.Mesh(cheekRestGeometry, cheekRestMaterial);
    cheekRest.position.set(0, 0.05, 0.45);
    this.mesh.add(cheekRest);

    // Add barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
    const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.2);
    this.mesh.add(barrel);

    // Add muzzle brake
    const muzzleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8);
    const muzzleMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const muzzle = new THREE.Mesh(muzzleGeometry, muzzleMaterial);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0, -0.4);
    this.mesh.add(muzzle);

    // Add muzzle brake vents
    for (let i = 0; i < 6; i++) {
      const ventGeometry = new THREE.BoxGeometry(0.06, 0.01, 0.01);
      const ventMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const vent = new THREE.Mesh(ventGeometry, ventMaterial);
      const angle = (i / 6) * Math.PI * 2;
      vent.position.set(0, Math.sin(angle) * 0.03, -0.4 + Math.cos(angle) * 0.03);
      vent.rotation.z = angle;
      this.mesh.add(vent);
    }

    // Position the gun in front of the camera
    this.mesh.position.set(0.3, -0.2, -0.5);
    this.camera.add(this.mesh);

    // Attach zoom events
    this.attachZoomEvent();

    return this.mesh;
  }

  attachZoomEvent() {
    if (this.zoomEventAttached) return;

    // Add right-click event listeners for zooming
    const onRightMouseDown = (event) => {
      if (event.button === 2) { // Right mouse button
        this.startZoom();
        event.preventDefault();
      }
    };

    const onRightMouseUp = (event) => {
      if (event.button === 2) { // Right mouse button
        this.endZoom();
        event.preventDefault();
      }
    };

    // Also handle when mouse leaves the window
    const onMouseLeave = () => {
      if (this.isZoomed && !this.keyZoomActive) {
        this.endZoom();
      }
    };

    // Add keyboard event listeners for V key zooming
    const onKeyDown = (event) => {
      if (event.code === 'KeyV') {
        console.log("V key pressed - starting zoom");
        this.keyZoomActive = true;
        this.startZoom();
      }
    };

    const onKeyUp = (event) => {
      if (event.code === 'KeyV') {
        console.log("V key released - ending zoom");
        this.keyZoomActive = false;
        this.endZoom();
      }
    };

    document.addEventListener('mousedown', onRightMouseDown);
    document.addEventListener('mouseup', onRightMouseUp);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Store the event listeners for cleanup
    this.zoomEventListeners = {
      mouseDown: onRightMouseDown,
      mouseUp: onRightMouseUp,
      mouseLeave: onMouseLeave,
      keyDown: onKeyDown,
      keyUp: onKeyUp
    };

    this.zoomEventAttached = true;
    console.log("Zoom events attached to sniper rifle (including V key)");
  }

  cleanup() {
    // Remove zoom event listeners when switching weapons
    if (this.zoomEventAttached && this.zoomEventListeners) {
      document.removeEventListener('mousedown', this.zoomEventListeners.mouseDown);
      document.removeEventListener('mouseup', this.zoomEventListeners.mouseUp);
      document.removeEventListener('mouseleave', this.zoomEventListeners.mouseLeave);
      document.removeEventListener('keydown', this.zoomEventListeners.keyDown);
      document.removeEventListener('keyup', this.zoomEventListeners.keyUp);
      this.zoomEventAttached = false;
      console.log("Zoom events removed from sniper rifle");
    }

    // Reset zoom if active
    if (this.isZoomed) {
      this.endZoom();
    }
  }

  startZoom() {
    if (this.isZoomed) return; // Already zoomed

    this.isZoomed = true;
    this.targetFOV = this.zoomedFOV;

    // Show scope overlay
    const scopeOverlay = document.getElementById('scope-overlay');
    if (scopeOverlay) {
      scopeOverlay.style.display = 'block';
    }

    // Hide gun when zoomed
    if (this.mesh) {
      this.mesh.visible = false;
    }

    console.log("Zooming in, target FOV:", this.targetFOV);
  }

  endZoom() {
    // Don't end zoom if key is still active
    if (!this.isZoomed) return;

    // If key zoom is active, don't end zoom
    if (this.keyZoomActive) {
      console.log("Not ending zoom because V key is still active");
      return;
    }

    this.isZoomed = false;
    this.targetFOV = this.originalFOV;

    // Hide scope overlay
    const scopeOverlay = document.getElementById('scope-overlay');
    if (scopeOverlay) {
      scopeOverlay.style.display = 'none';
    }

    // Show gun when not zoomed
    if (this.mesh) {
      this.mesh.visible = true;
    }

    console.log("Zooming out, target FOV:", this.targetFOV);
  }

  update(delta) {
    // Handle smooth FOV transition for zooming
    if (this.camera.fov !== this.targetFOV) {
      // Calculate how much to change FOV this frame
      const fovDelta = (this.targetFOV - this.camera.fov) * this.zoomTransitionSpeed * delta;

      // If we're very close to the target, just set it directly
      if (Math.abs(fovDelta) < 0.1) {
        this.camera.fov = this.targetFOV;
      } else {
        this.camera.fov += fovDelta;
      }

      // Update the camera projection matrix
      this.camera.updateProjectionMatrix();
    }
  }

  shoot() {
    // Only shoot if we can
    if (!this.canShoot) return;

    // Play shooting sound
    this.playSound('shoot');

    // Create bullet geometry
    const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Get barrel position
    const barrelTip = new THREE.Vector3(0, 0, -0.4);
    this.mesh.updateMatrixWorld(true);
    barrelTip.applyMatrix4(this.mesh.matrixWorld);

    // Set bullet position to start from the barrel
    bullet.position.copy(barrelTip);

    // Set bullet direction based on camera direction
    const bulletDirection = new THREE.Vector3(0, 0, -1);
    bulletDirection.applyQuaternion(this.camera.quaternion);
    bullet.userData.direction = bulletDirection;
    bullet.userData.velocity = 200; // Very fast bullet
    bullet.userData.alive = true;
    bullet.userData.createdAt = performance.now();
    bullet.userData.lifespan = 5000; // Long lifespan
    bullet.userData.damage = this.damage; // High damage

    // Add bullet to scene and bullets array
    this.scene.add(bullet);
    this.bullets.push(bullet);

    // Add bullet trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });

    const trailPositions = new Float32Array(2 * 3); // 2 points, 3 coordinates each
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    bullet.userData.trail = trail;
    this.scene.add(trail);

    // Add recoil animation
    const originalPosition = this.mesh.position.clone();
    this.mesh.position.z += 0.1; // Recoil

    // Return to original position gradually
    setTimeout(() => {
      this.mesh.position.copy(originalPosition);
    }, 200);

    // Set shooting cooldown
    this.canShoot = false;
    setTimeout(() => {
      this.canShoot = true;
    }, this.shootCooldown * 1000);
  }

  // Custom sound for sniper rifle
  playSound(type) {
    if (type === 'shoot') {
      // Create oscillators for a sniper rifle sound
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Set parameters for a sniper rifle sound
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.2);

      // Volume envelope
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

      // Play and stop
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } else {
      // For other sound types (impact, explosion), use the parent class method
      super.playSound(type);
    }
  }
}

// Bazooka class
class Bazooka extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.shootCooldown = 2.0; // Very slow fire rate
    this.damage = 200; // High damage
    this.isMouseDown = false;
  }

  create() {
    // Create bazooka mesh
    const bazookaGroup = new THREE.Group();

    // Main tube
    const tubeGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 16);
    const tubeMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.rotation.x = Math.PI / 2; // Fix orientation - rotate around X instead of Z
    tube.position.set(0, 0, 0.3);
    bazookaGroup.add(tube);

    // Wider back part
    const backGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.3, 16);
    const backMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const back = new THREE.Mesh(backGeometry, backMaterial);
    back.rotation.x = Math.PI / 2; // Fix orientation
    back.position.set(0, 0, -0.2);
    bazookaGroup.add(back);

    // Handle
    const handleGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, -0.2, 0);
    bazookaGroup.add(handle);

    // Sight
    const sightGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.05);
    const sightMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const sight = new THREE.Mesh(sightGeometry, sightMaterial);
    sight.position.set(0, 0.1, 0.2);
    bazookaGroup.add(sight);

    // Red tip
    const tipGeometry = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16);
    const tipMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.rotation.x = Math.PI / 2; // Fix orientation
    tip.position.set(0, 0, 0.85);
    bazookaGroup.add(tip);

    // Position the bazooka in front of the camera
    bazookaGroup.position.set(0.3, -0.2, -0.5);

    // Add to camera
    this.mesh = bazookaGroup;
    this.camera.add(this.mesh);

    // Make sure we can shoot initially
    this.canShoot = true;
  }

  shoot() {
    // Only shoot if we can
    if (!this.canShoot) {
      console.log("Bazooka cooling down, can't shoot yet");
      return;
    }

    console.log("Firing bazooka!");

    // Play shooting sound
    this.playSound('shoot');

    // Create rocket geometry - make it larger and more visible
    const rocketGeometry = new THREE.CylinderGeometry(0.05, 0.1, 0.4, 8);
    const rocketMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);

    // Add fins to the rocket
    const finGeometry = new THREE.BoxGeometry(0.15, 0.02, 0.1);
    const finMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });

    // Add 4 fins
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeometry, finMaterial);
      fin.position.z = 0.15;
      fin.rotation.y = (Math.PI / 2) * i;
      rocket.add(fin);
    }

    // Get barrel position
    const barrelTip = new THREE.Vector3(0, 0, -0.5);
    this.mesh.updateMatrixWorld(true);
    barrelTip.applyMatrix4(this.mesh.matrixWorld);

    // Set rocket position to start from the barrel
    rocket.position.copy(barrelTip);

    // Set rocket direction based on camera direction
    const rocketDirection = new THREE.Vector3(0, 0, -1);
    rocketDirection.applyQuaternion(this.camera.quaternion);

    // Rotate rocket to face direction of travel
    rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rocketDirection);

    // Add rocket properties
    rocket.userData.direction = rocketDirection;
    rocket.userData.velocity = 40; // Slower than bullets but still fast
    rocket.userData.alive = true;
    rocket.userData.createdAt = performance.now();
    rocket.userData.lifespan = 10000; // 10 seconds
    rocket.userData.damage = this.damage;
    rocket.userData.isRocket = true;
    rocket.userData.explosionRadius = 5;
    rocket.userData.explosionForce = 20;

    // Add rocket trail
    this.createRocketTrail(rocket);

    // Add to scene and bullets array
    this.scene.add(rocket);
    this.bullets.push(rocket);

    // Add recoil animation
    const originalPosition = this.mesh.position.clone();
    this.mesh.position.z += 0.2; // Strong recoil

    // Return to original position gradually
    setTimeout(() => {
      this.mesh.position.copy(originalPosition);
    }, 300);

    // Set shooting cooldown
    this.canShoot = false;
    setTimeout(() => {
      this.canShoot = true;
      console.log("Bazooka ready to fire again");
    }, this.shootCooldown * 1000);
  }

  createRocketTrail(rocket) {
    // Create a more visible trail for the rocket
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.PointsMaterial({
      color: 0xff5500,
      size: 0.5,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    // Create a trail with multiple points
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Initialize all positions to rocket's position
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = rocket.position.x;
      positions[i3 + 1] = rocket.position.y;
      positions[i3 + 2] = rocket.position.z;

      // Color gradient from yellow to red
      const t = i / particleCount;
      colors[i3] = 1.0; // R
      colors[i3 + 1] = 0.5 * (1 - t); // G
      colors[i3 + 2] = 0.0; // B
    }

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const trail = new THREE.Points(trailGeometry, trailMaterial);

    // Store trail data in rocket
    rocket.userData.trail = trail;
    rocket.userData.trailPositions = positions;
    rocket.userData.trailColors = colors;
    rocket.userData.trailMaxParticles = particleCount;

    this.scene.add(trail);

    // Add smoke particles that emit continuously
    this.createRocketSmokeEmitter(rocket);
  }

  createRocketSmokeEmitter(rocket) {
    // Create a function to emit smoke particles
    rocket.userData.emitSmoke = () => {
      if (!rocket.userData.alive) return;

      // Create a smoke particle
      const smokeGeometry = new THREE.BufferGeometry();
      const smokePositions = new Float32Array(3);
      smokePositions[0] = rocket.position.x;
      smokePositions[1] = rocket.position.y;
      smokePositions[2] = rocket.position.z;

      smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

      const smokeMaterial = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.5 + Math.random() * 0.5,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true
      });

      const smoke = new THREE.Points(smokeGeometry, smokeMaterial);
      smoke.userData.createdAt = performance.now();
      smoke.userData.lifespan = 1000; // 1 second
      smoke.userData.isSmoke = true;

      // Add slight random velocity
      smoke.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      );

      this.scene.add(smoke);

      // Add to global particles array
      if (!window.particles) window.particles = [];
      window.particles.push(smoke);

      // Schedule next smoke emission
      if (rocket.userData.alive) {
        setTimeout(rocket.userData.emitSmoke, 50);
      }
    };

    // Start emitting smoke
    rocket.userData.emitSmoke();
  }

  updateRocketTrail(rocket, delta) {
    if (!rocket.userData.trail) return;

    const currentTime = performance.now();
    const timeSinceLastUpdate = currentTime - rocket.userData.lastTrailUpdateTime;

    // Update trail less frequently for performance
    if (timeSinceLastUpdate < 20) return;

    rocket.userData.lastTrailUpdateTime = currentTime;

    // Get positions array
    const positions = rocket.userData.trailPositions;
    const colors = rocket.userData.trailColors;

    // Shift all particles one position back
    for (let i = rocket.userData.trailMaxParticles - 1; i > 0; i--) {
      positions[i * 3] = positions[(i - 1) * 3];
      positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
      positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
    }

    // Add slight randomness to trail
    const randomOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05
    );

    // Set first particle to rocket position
    positions[0] = rocket.position.x + randomOffset.x;
    positions[1] = rocket.position.y + randomOffset.y;
    positions[2] = rocket.position.z + randomOffset.z;

    // Update the buffer attribute
    rocket.userData.trail.geometry.attributes.position.needsUpdate = true;

    // Fade out particles over time
    for (let i = 0; i < rocket.userData.trailMaxParticles; i++) {
      const alpha = 1 - (i / rocket.userData.trailMaxParticles);
      rocket.userData.trail.geometry.attributes.color.array[i * 3 + 0] *= 0.99;
      rocket.userData.trail.geometry.attributes.color.array[i * 3 + 1] *= 0.99;
      rocket.userData.trail.geometry.attributes.color.array[i * 3 + 2] *= 0.99;
    }

    rocket.userData.trail.geometry.attributes.color.needsUpdate = true;
  }

  createExplosion(position, radius, force) {
    // Create explosion light with shorter duration
    const explosionLight = new THREE.PointLight(0xff7700, 5, radius * 3);
    explosionLight.position.copy(position);
    this.scene.add(explosionLight);

    // Remove light after a short delay (300ms instead of potentially staying forever)
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

    // Apply explosion damage
    this.applyExplosionDamage(position, radius, force);

    // Play explosion sound
    this.playSound('explosion');

    // Create ground scorch mark if explosion is near ground
    if (position.y < radius) {
      this.createScorchMark(position, radius);
    }

    // Create smoke cloud that lingers
    this.createSmokeCloud(position, radius);
  }

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
        }
      }
    }
  }
}

// Translocator Gun class
class TranslocatorGun extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.name = "Translocator";
    this.damage = 100;
    this.reloadTime = 2000; // 2 seconds
    this.lastShootTime = 0;
    this.canShoot = true;
    this.projectile = null;
    this.isControllingProjectile = false;
    this.originalCameraPosition = new THREE.Vector3();
    this.originalCameraRotation = new THREE.Euler();
    this.projectileSpeed = 30;
    this.projectileControlSpeed = 50; // Increased speed when controlling the projectile
    this.maxFlightTime = 10; // seconds
    this.flightStartTime = 0;
    this.projectileCamera = null;
    this.trailParticles = [];
    this.explosionRadius = 10;
    this.explosionForce = 1000;
    this.projectileLight = null;
    this.originalRenderer = null;
    this.originalCamera = null;
    this.originalControlsParent = null;
    this.mouseMoveHandler = null; // Store the mouse move handler for cleanup
    this.pointerLockChangeHandler = null; // Store the pointer lock change handler for cleanup
  }

  create() {
    // Create gun mesh
    this.mesh = new THREE.Group();

    // Create gun body
    const bodyGeometry = new THREE.CylinderGeometry(0.05, 0.1, 0.3, 8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    this.mesh.add(body);

    // Create barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
    const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.position.z = 0.2;
    barrel.rotation.x = Math.PI / 2;
    this.mesh.add(barrel);

    // Create energy core
    const coreGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.z = 0.1;
    core.position.y = 0.08;
    this.mesh.add(core);

    // Add pulsing light to core
    const coreLight = new THREE.PointLight(0x00ffff, 1, 0.5);
    coreLight.position.copy(core.position);
    this.mesh.add(coreLight);

    // Animate the core light
    const pulseCore = () => {
      if (!this.mesh) return;

      const time = Date.now() * 0.001;
      const intensity = 0.5 + 0.5 * Math.sin(time * 5);
      coreLight.intensity = intensity;

      requestAnimationFrame(pulseCore);
    };
    pulseCore();

    // Position the gun in front of the camera
    this.mesh.position.set(0.3, -0.2, -0.5);
    this.camera.add(this.mesh);

    return this.mesh;
  }

  update(delta) {
    // If we're controlling the projectile, update its movement
    if (this.isControllingProjectile && this.projectile) {
      this.updateProjectileControl(delta);

      // Check if max flight time is exceeded
      const currentTime = performance.now() / 1000;
      if (currentTime - this.flightStartTime > this.maxFlightTime) {
        this.detonateProjectile();
      }
    }

    // Update trail particles
    this.updateTrailParticles(delta);
  }

  shoot() {
    if (!this.canShoot) return;

    const now = performance.now();
    if (now - this.lastShootTime < this.reloadTime) return;

    this.lastShootTime = now;
    this.canShoot = false;

    // If already controlling a projectile, detonate it
    if (this.isControllingProjectile) {
      this.detonateProjectile();
      return;
    }

    // Create projectile
    const projectileGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const projectileMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1
    });
    this.projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    // Position projectile at gun barrel
    const barrelPosition = new THREE.Vector3(0, 0, -0.5);
    barrelPosition.applyMatrix4(this.mesh.matrixWorld);
    this.projectile.position.copy(barrelPosition);

    // Get direction from camera
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    direction.normalize();

    // Store direction and initial velocity
    this.projectile.userData = {
      velocity: direction.clone().multiplyScalar(this.projectileSpeed),
      direction: direction.clone(),
      damage: this.damage,
      createdAt: now
    };

    // Add projectile to scene
    this.scene.add(this.projectile);

    // Add light to projectile
    this.projectileLight = new THREE.PointLight(0x00ffff, 1, 5);
    this.projectileLight.position.copy(this.projectile.position);
    this.scene.add(this.projectileLight);

    // Play shoot sound
    this.playSound('shoot');

    // Start controlling projectile immediately
    this.startProjectileControl();
  }

  startProjectileControl() {
    if (!this.projectile) return;

    // Store original camera position and rotation
    this.originalCameraPosition.copy(this.camera.position);
    this.originalCameraRotation.copy(this.camera.rotation);

    // Store original camera and renderer references
    this.originalCamera = window.camera;
    this.originalRenderer = window.renderer;

    // Create a camera for the projectile with wider FOV for a more dramatic effect
    this.projectileCamera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Position the camera exactly at the projectile position
    this.projectileCamera.position.copy(this.projectile.position);

    // Set initial camera orientation to match player camera
    this.projectileCamera.quaternion.copy(this.camera.quaternion);

    // Replace the main camera with the projectile camera
    window.camera = this.projectileCamera;

    // Add the projectile camera to the scene
    this.scene.add(this.projectileCamera);

    // Initialize Euler angles for tracking rotation
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Extract initial rotation from camera quaternion to initialize euler angles
    euler.setFromQuaternion(this.projectileCamera.quaternion);

    // Create mouse move handler with proper orientation and enhanced sensitivity
    this.mouseMoveHandler = (event) => {
      if (!document.pointerLockElement) return;

      // Get mouse movement with increased sensitivity for more responsive control
      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

      // Update euler angles with enhanced sensitivity
      euler.y -= movementX * 0.003; // Increased horizontal sensitivity
      euler.x -= movementY * 0.003; // Increased vertical sensitivity

      // Allow more extreme vertical rotation for acrobatic maneuvers
      euler.x = Math.max(-Math.PI * 0.7, Math.min(Math.PI * 0.7, euler.x));

      // Apply rotation to camera
      this.projectileCamera.quaternion.setFromEuler(euler);
    };

    // Add pointer lock change handler
    const pointerLockChangeHandler = () => {
      isPointerLocked = document.pointerLockElement !== null;
    };

    // Store the handler for cleanup
    this.pointerLockChangeHandler = pointerLockChangeHandler;

    // Add event listeners
    document.addEventListener('mousemove', this.mouseMoveHandler, false);
    document.addEventListener('pointerlockchange', pointerLockChangeHandler, false);

    // Create a visible projectile model that appears in front of the camera
    const projectileModelGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
    projectileModelGeometry.rotateX(-Math.PI / 2); // Point forward
    const projectileModelMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7,
      wireframe: true // Add wireframe for a more high-tech look
    });
    this.projectileModel = new THREE.Mesh(projectileModelGeometry, projectileModelMaterial);
    this.projectileModel.position.set(0, 0, -0.5); // Position in front of camera
    this.projectileCamera.add(this.projectileModel);

    // Add fins to the projectile model with glowing effect
    const finGeometry = new THREE.PlaneGeometry(0.2, 0.1);
    const finMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0
    });

    // Top fin
    const topFin = new THREE.Mesh(finGeometry, finMaterial);
    topFin.position.set(0, 0.1, 0.05);
    topFin.rotation.x = Math.PI / 2;
    this.projectileModel.add(topFin);

    // Bottom fin
    const bottomFin = new THREE.Mesh(finGeometry, finMaterial);
    bottomFin.position.set(0, -0.1, 0.05);
    bottomFin.rotation.x = Math.PI / 2;
    this.projectileModel.add(bottomFin);

    // Left fin
    const leftFin = new THREE.Mesh(finGeometry, finMaterial);
    leftFin.position.set(-0.1, 0, 0.05);
    leftFin.rotation.z = Math.PI / 2;
    leftFin.rotation.x = Math.PI / 2;
    this.projectileModel.add(leftFin);

    // Right fin
    const rightFin = new THREE.Mesh(finGeometry, finMaterial);
    rightFin.position.set(0.1, 0, 0.05);
    rightFin.rotation.z = Math.PI / 2;
    rightFin.rotation.x = Math.PI / 2;
    this.projectileModel.add(rightFin);

    // Add HUD elements for projectile view
    this.createProjectileHUD();

    // Hide the gun while controlling projectile
    if (this.mesh) {
      this.mesh.visible = false;
    }

    // Hide the crosshair
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.style.display = 'none';
    }

    // Set flag
    this.isControllingProjectile = true;
    this.flightStartTime = performance.now() / 1000;

    // Play transition sound
    this.playSound('transition');

    // Add a subtle rotation effect to simulate projectile spin
    this.projectileSpinRate = 0.5; // radians per second
    this.lastSpinTime = performance.now();

    console.log("Switched to projectile view - Guided missile mode");
  }

  // Create HUD elements for projectile view
  createProjectileHUD() {
    // Remove any existing HUD
    this.removeProjectileHUD();

    // Create HUD container
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'projectile-hud';
    this.hudContainer.style.position = 'absolute';
    this.hudContainer.style.top = '0';
    this.hudContainer.style.left = '0';
    this.hudContainer.style.width = '100%';
    this.hudContainer.style.height = '100%';
    this.hudContainer.style.pointerEvents = 'none';
    this.hudContainer.style.zIndex = '100';
    document.body.appendChild(this.hudContainer);

    // Add full-screen overlay with sci-fi border effect
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.boxShadow = 'inset 0 0 150px rgba(0, 255, 255, 0.3)';
    overlay.style.border = '2px solid rgba(0, 255, 255, 0.5)';
    overlay.style.pointerEvents = 'none';
    this.hudContainer.appendChild(overlay);

    // Add corner elements for a sci-fi HUD feel
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    corners.forEach(corner => {
      const cornerElement = document.createElement('div');
      cornerElement.style.position = 'absolute';
      cornerElement.style.width = '80px';
      cornerElement.style.height = '80px';
      cornerElement.style.borderColor = 'rgba(0, 255, 255, 0.7)';
      cornerElement.style.borderWidth = '3px';

      // Set position and border style based on corner
      if (corner === 'top-left') {
        cornerElement.style.top = '10px';
        cornerElement.style.left = '10px';
        cornerElement.style.borderTop = '3px solid rgba(0, 255, 255, 0.7)';
        cornerElement.style.borderLeft = '3px solid rgba(0, 255, 255, 0.7)';
      } else if (corner === 'top-right') {
        cornerElement.style.top = '10px';
        cornerElement.style.right = '10px';
        cornerElement.style.borderTop = '3px solid rgba(0, 255, 255, 0.7)';
        cornerElement.style.borderRight = '3px solid rgba(0, 255, 255, 0.7)';
      } else if (corner === 'bottom-left') {
        cornerElement.style.bottom = '10px';
        cornerElement.style.left = '10px';
        cornerElement.style.borderBottom = '3px solid rgba(0, 255, 255, 0.7)';
        cornerElement.style.borderLeft = '3px solid rgba(0, 255, 255, 0.7)';
      } else if (corner === 'bottom-right') {
        cornerElement.style.bottom = '10px';
        cornerElement.style.right = '10px';
        cornerElement.style.borderBottom = '3px solid rgba(0, 255, 255, 0.7)';
        cornerElement.style.borderRight = '3px solid rgba(0, 255, 255, 0.7)';
      }

      this.hudContainer.appendChild(cornerElement);
    });

    // Add horizontal scan line
    const scanLine = document.createElement('div');
    scanLine.style.position = 'absolute';
    scanLine.style.top = '50%';
    scanLine.style.left = '0';
    scanLine.style.width = '100%';
    scanLine.style.height = '2px';
    scanLine.style.backgroundColor = 'rgba(0, 255, 255, 0.3)';
    scanLine.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
    scanLine.style.transform = 'translateY(-50%)';
    this.hudContainer.appendChild(scanLine);

    // Add vertical scan line
    const verticalScanLine = document.createElement('div');
    verticalScanLine.style.position = 'absolute';
    verticalScanLine.style.top = '0';
    verticalScanLine.style.left = '50%';
    verticalScanLine.style.width = '2px';
    verticalScanLine.style.height = '100%';
    verticalScanLine.style.backgroundColor = 'rgba(0, 255, 255, 0.3)';
    verticalScanLine.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
    verticalScanLine.style.transform = 'translateX(-50%)';
    this.hudContainer.appendChild(verticalScanLine);

    // Add targeting reticle (smaller and more subtle)
    const reticle = document.createElement('div');
    reticle.style.position = 'absolute';
    reticle.style.top = '50%';
    reticle.style.left = '50%';
    reticle.style.width = '40px';
    reticle.style.height = '40px';
    reticle.style.marginTop = '-20px';
    reticle.style.marginLeft = '-20px';
    reticle.style.border = '1px solid rgba(0, 255, 255, 0.7)';
    reticle.style.borderRadius = '50%';
    reticle.style.boxShadow = '0 0 5px rgba(0, 255, 255, 0.5)';
    this.hudContainer.appendChild(reticle);

    // Add inner reticle dot
    const innerReticle = document.createElement('div');
    innerReticle.style.position = 'absolute';
    innerReticle.style.top = '50%';
    innerReticle.style.left = '50%';
    innerReticle.style.width = '4px';
    innerReticle.style.height = '4px';
    innerReticle.style.marginTop = '-2px';
    innerReticle.style.marginLeft = '-2px';
    innerReticle.style.backgroundColor = 'rgba(0, 255, 255, 0.9)';
    innerReticle.style.borderRadius = '50%';
    innerReticle.style.boxShadow = '0 0 3px rgba(0, 255, 255, 0.9)';
    this.hudContainer.appendChild(innerReticle);

    // Add full-screen scanlines effect
    const scanlines = document.createElement('div');
    scanlines.style.position = 'absolute';
    scanlines.style.top = '0';
    scanlines.style.left = '0';
    scanlines.style.width = '100%';
    scanlines.style.height = '100%';
    scanlines.style.background = 'linear-gradient(rgba(0, 255, 255, 0.03) 50%, transparent 50%)';
    scanlines.style.backgroundSize = '100% 4px';
    scanlines.style.pointerEvents = 'none';
    scanlines.style.opacity = '0.3';
    this.hudContainer.appendChild(scanlines);

    // Add data panel in top-left
    const dataPanel = document.createElement('div');
    dataPanel.style.position = 'absolute';
    dataPanel.style.top = '30px';
    dataPanel.style.left = '30px';
    dataPanel.style.padding = '10px';
    dataPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dataPanel.style.border = '1px solid rgba(0, 255, 255, 0.5)';
    dataPanel.style.borderRadius = '5px';
    dataPanel.style.color = '#00ffff';
    dataPanel.style.fontFamily = 'monospace';
    dataPanel.style.fontSize = '14px';
    dataPanel.style.textShadow = '0 0 5px rgba(0, 255, 255, 0.5)';
    dataPanel.style.width = '180px';
    this.hudContainer.appendChild(dataPanel);

    // Add data panel content
    const dataPanelTitle = document.createElement('div');
    dataPanelTitle.style.borderBottom = '1px solid rgba(0, 255, 255, 0.5)';
    dataPanelTitle.style.paddingBottom = '5px';
    dataPanelTitle.style.marginBottom = '5px';
    dataPanelTitle.style.fontWeight = 'bold';
    dataPanelTitle.textContent = 'TRANSLOCATOR SYSTEMS';
    dataPanel.appendChild(dataPanelTitle);

    // Add flight time indicator
    this.flightTimeIndicator = document.createElement('div');
    this.flightTimeIndicator.style.margin = '5px 0';
    this.flightTimeIndicator.textContent = 'FLIGHT TIME: 0.00s';
    dataPanel.appendChild(this.flightTimeIndicator);

    // Add speed indicator
    this.speedIndicator = document.createElement('div');
    this.speedIndicator.style.margin = '5px 0';
    this.speedIndicator.textContent = 'SPEED: ' + Math.round(this.projectileControlSpeed) + ' m/s';
    dataPanel.appendChild(this.speedIndicator);

    // Add altitude indicator
    this.altitudeIndicator = document.createElement('div');
    this.altitudeIndicator.style.margin = '5px 0';
    this.altitudeIndicator.textContent = 'ALTITUDE: ' + this.projectile.position.y.toFixed(1) + ' m';
    dataPanel.appendChild(this.altitudeIndicator);

    // Add status indicator
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.style.margin = '5px 0';
    this.statusIndicator.style.color = '#00ff00';
    this.statusIndicator.textContent = 'STATUS: NOMINAL';
    dataPanel.appendChild(this.statusIndicator);

    // Add navigation compass at the top
    const compass = document.createElement('div');
    compass.style.position = 'absolute';
    compass.style.top = '10px';
    compass.style.left = '50%';
    compass.style.transform = 'translateX(-50%)';
    compass.style.width = '300px';
    compass.style.height = '30px';
    compass.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    compass.style.border = '1px solid rgba(0, 255, 255, 0.5)';
    compass.style.borderRadius = '5px';
    compass.style.overflow = 'hidden';
    this.hudContainer.appendChild(compass);

    // Add compass markers
    const directions = ['W', 'NW', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    const compassTrack = document.createElement('div');
    compassTrack.style.position = 'absolute';
    compassTrack.style.top = '5px';
    compassTrack.style.left = '0';
    compassTrack.style.width = '600px';
    compassTrack.style.height = '20px';
    compassTrack.style.display = 'flex';
    compassTrack.style.justifyContent = 'space-between';
    compass.appendChild(compassTrack);

    // Add compass direction markers
    directions.forEach((dir, index) => {
      const marker = document.createElement('div');
      marker.style.color = '#00ffff';
      marker.style.fontFamily = 'monospace';
      marker.style.fontSize = '12px';
      marker.style.textAlign = 'center';
      marker.style.width = '30px';
      marker.textContent = dir;
      compassTrack.appendChild(marker);
    });

    // Add compass needle
    const compassNeedle = document.createElement('div');
    compassNeedle.style.position = 'absolute';
    compassNeedle.style.top = '0';
    compassNeedle.style.left = '50%';
    compassNeedle.style.width = '2px';
    compassNeedle.style.height = '30px';
    compassNeedle.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    compassNeedle.style.transform = 'translateX(-50%)';
    compass.appendChild(compassNeedle);

    // Add warning indicator (initially hidden)
    this.warningIndicator = document.createElement('div');
    this.warningIndicator.style.position = 'absolute';
    this.warningIndicator.style.top = '50%';
    this.warningIndicator.style.left = '50%';
    this.warningIndicator.style.transform = 'translate(-50%, -50%)';
    this.warningIndicator.style.color = '#ff0000';
    this.warningIndicator.style.fontFamily = 'monospace';
    this.warningIndicator.style.fontSize = '24px';
    this.warningIndicator.style.fontWeight = 'bold';
    this.warningIndicator.style.textShadow = '0 0 10px #ff0000';
    this.warningIndicator.style.display = 'none';
    this.warningIndicator.textContent = 'PROXIMITY WARNING';
    this.hudContainer.appendChild(this.warningIndicator);

    // Add instruction text
    const instructionText = document.createElement('div');
    instructionText.style.position = 'absolute';
    instructionText.style.bottom = '20px';
    instructionText.style.left = '50%';
    instructionText.style.transform = 'translateX(-50%)';
    instructionText.style.color = '#00ffff';
    instructionText.style.fontFamily = 'monospace';
    instructionText.style.fontSize = '14px';
    instructionText.style.textAlign = 'center';
    instructionText.style.textShadow = '0 0 5px rgba(0, 255, 255, 0.5)';
    instructionText.textContent = 'CLICK or SPACE to detonate';
    this.hudContainer.appendChild(instructionText);

    // Store compass track for updating
    this.compassTrack = compassTrack;
  }

  // Remove HUD elements
  removeProjectileHUD() {
    const existingHUD = document.getElementById('projectile-hud');
    if (existingHUD) {
      document.body.removeChild(existingHUD);
    }
  }

  updateProjectileControl(delta) {
    if (!this.projectile || !this.isControllingProjectile) return;

    // Get the current direction the camera is facing
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.projectileCamera.quaternion);
    direction.normalize();

    // Move the projectile forward in the direction the camera is facing
    const moveDistance = this.projectileControlSpeed * delta;

    // Update both the projectile and camera position together
    // This prevents any position jumps due to synchronization issues
    const movement = direction.clone().multiplyScalar(moveDistance);
    this.projectile.position.add(movement);
    this.projectileCamera.position.copy(this.projectile.position);

    // Update projectile light position
    if (this.projectileLight) {
      this.projectileLight.position.copy(this.projectile.position);
    }

    // Create trail particles
    this.createTrailParticle();

    // Check for collisions
    this.checkProjectileCollisions();

    // Update HUD elements if they exist
    this.updateProjectileHUD(delta);

    // Apply subtle spin effect to the projectile model
    if (this.projectileModel) {
      const now = performance.now();
      const spinDelta = (now - this.lastSpinTime) / 1000;
      this.lastSpinTime = now;

      // Apply a subtle roll rotation to the projectile model
      this.projectileModel.rotation.z += this.projectileSpinRate * spinDelta;

      // Add a subtle wobble effect
      const flightTime = (now / 1000) - this.flightStartTime;
      const wobbleAmount = 0.02;
      this.projectileModel.rotation.x = Math.sin(flightTime * 2) * wobbleAmount;
      this.projectileModel.rotation.y = Math.cos(flightTime * 3) * wobbleAmount;
    }

    // Apply a subtle camera shake effect
    const shakeAmount = 0.0005;
    this.projectileCamera.position.x += (Math.random() - 0.5) * shakeAmount;
    this.projectileCamera.position.y += (Math.random() - 0.5) * shakeAmount;
    this.projectileCamera.position.z += (Math.random() - 0.5) * shakeAmount;

    // Apply a subtle chromatic aberration effect by adjusting the renderer
    if (window.renderer && window.renderer.domElement) {
      // Reset any previous filter
      window.renderer.domElement.style.filter = `
        saturate(1.2)
        brightness(1.1)
        contrast(1.1)
        hue-rotate(${Math.sin(performance.now() * 0.001) * 5}deg)
      `;
    }
  }

  // Update HUD elements
  updateProjectileHUD(delta) {
    if (!this.hudContainer) return;

    // Update flight time
    if (this.flightTimeIndicator) {
      const flightTime = performance.now() / 1000 - this.flightStartTime;
      this.flightTimeIndicator.textContent = `FLIGHT TIME: ${flightTime.toFixed(2)}s`;
    }

    // Update speed
    if (this.speedIndicator) {
      this.speedIndicator.textContent = `SPEED: ${Math.round(this.projectileControlSpeed)} m/s`;
    }

    // Update altitude
    if (this.altitudeIndicator) {
      this.altitudeIndicator.textContent = `ALTITUDE: ${this.projectile.position.y.toFixed(1)} m`;

      // Change status indicator based on altitude
      if (this.statusIndicator) {
        if (this.projectile.position.y < 1.0) {
          this.statusIndicator.textContent = 'STATUS: WARNING';
          this.statusIndicator.style.color = '#ff0000';
        } else {
          this.statusIndicator.textContent = 'STATUS: NOMINAL';
          this.statusIndicator.style.color = '#00ff00';
        }
      }
    }

    // Update compass based on camera direction
    if (this.compassTrack) {
      // Get the current direction the camera is facing
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(this.projectileCamera.quaternion);
      direction.y = 0; // Ignore vertical component
      direction.normalize();

      // Calculate angle in degrees (0 = North, 90 = East, etc.)
      const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI);

      // Move the compass track based on the angle
      // Each direction marker is approximately 60px apart in our 600px track
      const offset = (angle / 360) * 600;
      this.compassTrack.style.transform = `translateX(${150 - offset}px)`;
    }

    // Show warning indicator when close to ground or obstacles
    if (this.warningIndicator) {
      // Check if close to ground
      const isCloseToGround = this.projectile.position.y < 1.0;

      // Check if close to walls
      let isCloseToWall = false;
      if (window.walls) {
        for (const wall of window.walls) {
          if (wall.userData.destroyed) continue;

          const wallPos = new THREE.Vector3();
          wall.getWorldPosition(wallPos);

          const distance = this.projectile.position.distanceTo(wallPos);
          if (distance < 3.0) {
            isCloseToWall = true;
            break;
          }
        }
      }

      // Show warning if close to ground or walls
      if (isCloseToGround || isCloseToWall) {
        this.warningIndicator.style.display = 'block';

        // Make it flash
        const flashRate = Math.sin(performance.now() * 0.01) > 0 ? 1 : 0.3;
        this.warningIndicator.style.opacity = flashRate.toString();
      } else {
        this.warningIndicator.style.display = 'none';
      }
    }

    // Pulse the reticle based on flight time
    const reticle = this.hudContainer.querySelector('div:nth-child(6)'); // The reticle element
    if (reticle) {
      const pulseScale = 1 + Math.sin(performance.now() * 0.005) * 0.1;
      reticle.style.transform = `scale(${pulseScale})`;
    }

    // Add a subtle movement to the corner elements
    const corners = this.hudContainer.querySelectorAll('div:nth-child(3), div:nth-child(4), div:nth-child(5), div:nth-child(6)');
    corners.forEach((corner, index) => {
      const time = performance.now() * 0.001;
      const offset = Math.sin(time + index) * 2;

      if (index === 0) { // top-left
        corner.style.transform = `translate(${offset}px, ${offset}px)`;
      } else if (index === 1) { // top-right
        corner.style.transform = `translate(${-offset}px, ${offset}px)`;
      } else if (index === 2) { // bottom-left
        corner.style.transform = `translate(${offset}px, ${-offset}px)`;
      } else if (index === 3) { // bottom-right
        corner.style.transform = `translate(${-offset}px, ${-offset}px)`;
      }
    });
  }

  createTrailParticle() {
    // Create a trail particle
    const particleGeometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7
    });

    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(this.projectile.position);

    // Add random offset
    particle.position.x += (Math.random() - 0.5) * 0.1;
    particle.position.y += (Math.random() - 0.5) * 0.1;
    particle.position.z += (Math.random() - 0.5) * 0.1;

    // Add particle data
    particle.userData = {
      createdAt: performance.now(),
      lifespan: 500 + Math.random() * 500 // 0.5-1 second lifespan
    };

    // Add to scene and trail array
    this.scene.add(particle);
    this.trailParticles.push(particle);
  }

  updateTrailParticles(delta) {
    if (!this.trailParticles.length) return;

    const now = performance.now();

    // Update each particle
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const particle = this.trailParticles[i];

      // Check if particle should be removed
      if (now - particle.userData.createdAt > particle.userData.lifespan) {
        this.scene.remove(particle);
        this.trailParticles.splice(i, 1);
        continue;
      }

      // Fade out particle
      const age = (now - particle.userData.createdAt) / particle.userData.lifespan;
      particle.material.opacity = 0.7 * (1 - age);

      // Shrink particle
      const scale = 1 - age;
      particle.scale.set(scale, scale, scale);
    }
  }

  checkProjectileCollisions() {
    if (!this.projectile || !this.isControllingProjectile) return;

    // Check collision with ground
    // Assuming ground is at y=0, adjust if your ground is at a different height
    if (this.projectile.position.y <= 0.2) { // 0.2 is the projectile radius
      this.detonateProjectile();
      return;
    }

    // Check collision with walls
    for (const wall of window.walls) {
      // Skip destroyed walls
      if (wall.userData.destroyed) continue;

      // Create bounding boxes
      const projectileSphere = new THREE.Sphere(
        this.projectile.position.clone(),
        0.2 // Projectile radius
      );

      const wallBox = new THREE.Box3().setFromObject(wall);

      // Check for collision
      if (wallBox.intersectsSphere(projectileSphere)) {
        this.detonateProjectile();
        return;
      }
    }

    // Check collision with enemies
    if (window.enemies) {
      for (const enemy of window.enemies) {
        if (enemy.isDead) continue;

        // Simple sphere collision detection
        const enemyPosition = enemy.mesh.position.clone();
        enemyPosition.y += 1.5; // Adjust to center of enemy

        const distance = this.projectile.position.distanceTo(enemyPosition);

        if (distance < 1.0) { // Enemy collision radius + projectile radius
          this.detonateProjectile();
          return;
        }
      }
    }

    // Check if we're out of bounds (too far from origin)
    const distanceFromOrigin = this.projectile.position.length();
    if (distanceFromOrigin > 100) { // Maximum allowed distance
      this.detonateProjectile();
      return;
    }
  }

  detonateProjectile() {
    if (!this.projectile) return;

    // Create explosion
    this.createExplosion(this.projectile.position.clone(), this.explosionRadius, this.explosionForce);

    // Apply damage to nearby objects
    this.applyExplosionDamage(this.projectile.position.clone(), this.explosionRadius, this.explosionForce);

    // Remove projectile
    this.scene.remove(this.projectile);
    this.projectile = null;

    // Remove projectile model if it exists
    if (this.projectileModel) {
      this.projectileCamera.remove(this.projectileModel);
      this.projectileModel = null;
    }

    // Remove projectile light
    if (this.projectileLight) {
      this.scene.remove(this.projectileLight);
      this.projectileLight = null;
    }

    // Remove projectile camera from scene
    if (this.projectileCamera) {
      this.scene.remove(this.projectileCamera);
    }

    // Remove HUD elements
    this.removeProjectileHUD();

    // Reset renderer filter effects
    if (window.renderer && window.renderer.domElement) {
      window.renderer.domElement.style.filter = '';
    }

    // Remove event listeners
    document.removeEventListener('mousemove', this.mouseMoveHandler, false);
    document.removeEventListener('pointerlockchange', this.pointerLockChangeHandler, false);

    // Restore original camera
    window.camera = this.originalCamera;

    // Show gun
    if (this.mesh) {
      this.mesh.visible = true;
    }

    // Show crosshair
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.style.display = 'block';
    }

    // Reset flag
    this.isControllingProjectile = false;

    // Play explosion sound
    this.playSound('explosion');

    // Add a camera shake effect to the player camera
    if (typeof window.shakeCamera === 'function') {
      window.shakeCamera(0.5);
    }

    console.log("Projectile detonated - Returning to player view");
  }

  playSound(type) {
    // Create and play sound
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    switch (type) {
      case 'shoot':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
        break;

      case 'transition':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
        break;

      case 'explosion':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);
        break;

      default:
        // For other sound types, use the parent class method
        super.playSound(type);
        break;
    }
  }
}

// Akimbo class - dual pistols that shoot alternately
class Akimbo extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.shootCooldown = 0.25; // Faster fire rate than single pistol
    this.damage = 20; // Slightly less damage per bullet than single pistol
    this.isMouseDown = false;
    this.alternateGun = 'right'; // Start with right gun
  }

  create() {
    // Create a gun group
    this.mesh = new THREE.Group();

    // Create left pistol
    this.leftPistol = new THREE.Group();

    // Create gun body for left pistol
    const leftBodyGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.25);
    const leftBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const leftBody = new THREE.Mesh(leftBodyGeometry, leftBodyMaterial);
    this.leftPistol.add(leftBody);

    // Create gun barrel for left pistol
    const leftBarrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
    const leftBarrelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const leftBarrel = new THREE.Mesh(leftBarrelGeometry, leftBarrelMaterial);
    leftBarrel.rotation.x = Math.PI / 2;
    leftBarrel.position.set(0, 0.03, 0.2);
    this.leftPistol.add(leftBarrel);

    // Create gun handle for left pistol
    const leftHandleGeometry = new THREE.BoxGeometry(0.06, 0.15, 0.05);
    const leftHandleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const leftHandle = new THREE.Mesh(leftHandleGeometry, leftHandleMaterial);
    leftHandle.position.y = -0.12;
    this.leftPistol.add(leftHandle);

    // Position the left pistol
    this.leftPistol.position.set(-0.15, -0.15, -0.4);

    // Create right pistol
    this.rightPistol = new THREE.Group();

    // Create gun body for right pistol
    const rightBodyGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.25);
    const rightBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const rightBody = new THREE.Mesh(rightBodyGeometry, rightBodyMaterial);
    this.rightPistol.add(rightBody);

    // Create gun barrel for right pistol
    const rightBarrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
    const rightBarrelMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const rightBarrel = new THREE.Mesh(rightBarrelGeometry, rightBarrelMaterial);
    rightBarrel.rotation.x = Math.PI / 2;
    rightBarrel.position.set(0, 0.03, 0.2);
    this.rightPistol.add(rightBarrel);

    // Create gun handle for right pistol
    const rightHandleGeometry = new THREE.BoxGeometry(0.06, 0.15, 0.05);
    const rightHandleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const rightHandle = new THREE.Mesh(rightHandleGeometry, rightHandleMaterial);
    rightHandle.position.y = -0.12;
    this.rightPistol.add(rightHandle);

    // Position the right pistol
    this.rightPistol.position.set(0.15, -0.15, -0.4);

    // Add both pistols to the main mesh
    this.mesh.add(this.leftPistol);
    this.mesh.add(this.rightPistol);

    // Add the mesh to the camera
    this.camera.add(this.mesh);

    return this.mesh;
  }

  update(delta) {
    // No special update needed for akimbo pistols
  }

  startFiring() {
    this.isMouseDown = true;
    this.continuousFire();
  }

  stopFiring() {
    this.isMouseDown = false;
  }

  continuousFire() {
    if (this.isMouseDown) {
      if (this.canShoot) {
        this.shoot();

        // Set shooting cooldown
        this.canShoot = false;
        setTimeout(() => {
          this.canShoot = true;
          // Continue firing if still holding mouse
          if (this.isMouseDown) {
            this.continuousFire();
          }
        }, this.shootCooldown * 1000);
      } else {
        // Check again after a short delay
        setTimeout(() => {
          if (this.isMouseDown) {
            this.continuousFire();
          }
        }, 10);
      }
    }
  }

  shoot() {
    // Only shoot if we can
    if (!this.canShoot) return;

    // Play shooting sound
    this.playSound('shoot');

    // Determine which gun to shoot from
    const currentGun = this.alternateGun === 'right' ? this.rightPistol : this.leftPistol;

    // Alternate guns for next shot
    this.alternateGun = this.alternateGun === 'right' ? 'left' : 'right';

    // Create bullet geometry
    const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff9900 }); // Orange-yellow bullets for akimbo
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Get barrel position
    const barrelTip = new THREE.Vector3(0, 0, 0.3);
    barrelTip.applyMatrix4(currentGun.matrixWorld);

    // Set bullet position to start from the barrel
    bullet.position.copy(barrelTip);

    // Set bullet direction based on camera direction
    const bulletDirection = new THREE.Vector3(0, 0, -1);
    bulletDirection.applyQuaternion(this.camera.quaternion);
    bullet.userData.direction = bulletDirection;
    bullet.userData.velocity = 70; // Same bullet speed as pistol
    bullet.userData.alive = true;
    bullet.userData.createdAt = performance.now();
    bullet.userData.lifespan = 2000; // Bullet lifespan in milliseconds
    bullet.userData.damage = this.damage; // Set bullet damage

    // Add bullet to scene and bullets array
    this.scene.add(bullet);
    this.bullets.push(bullet);

    // Add bullet trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff9900, opacity: 0.5, transparent: true });

    const trailPositions = new Float32Array(2 * 3); // 2 points, 3 coordinates each
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    bullet.userData.trail = trail;
    this.scene.add(trail);

    // Add recoil animation to the current gun
    const originalPosition = currentGun.position.clone();
    currentGun.position.z += 0.05; // Move gun backward

    // Return to original position
    setTimeout(() => {
      currentGun.position.copy(originalPosition);
    }, 100);
  }

  // Custom akimbo sound - slightly different from pistol
  generateShootSound() {
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Set parameters for a pistol sound with slight variation
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);

    // Volume envelope - sharper attack for pistol
    gainNode.gain.setValueAtTime(0.35, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    // Play and stop
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Override the playSound method to use our custom sound
  playSound(type) {
    if (type === 'shoot') {
      this.generateShootSound();
    } else {
      // For other sound types (impact, explosion), use the parent class method
      super.playSound(type);
    }
  }
}

// Export all gun classes
const GunSystem = {
  Gun,
  GatlingGun,
  Pistol,
  SniperRifle,
  Bazooka,
  TranslocatorGun,
  Akimbo // Add the new Akimbo class to the export
};

// Make GunSystem available globally
window.GunSystem = GunSystem; 