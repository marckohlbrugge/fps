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
    // Play shooting sound
    this.playSound('shoot');

    // Create bullet geometry
    const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Get current barrel position (the one at the top)
    const barrelTip = new THREE.Vector3(0, 0.08, 0.5);
    barrelTip.applyMatrix4(this.barrels.matrixWorld);

    // Set bullet position to start from the current barrel
    bullet.position.copy(barrelTip);

    // Set bullet direction based on camera direction
    const bulletDirection = new THREE.Vector3(0, 0, -1);
    bulletDirection.applyQuaternion(this.camera.quaternion);
    bullet.userData.direction = bulletDirection;
    bullet.userData.velocity = 50; // Bullet speed
    bullet.userData.alive = true;
    bullet.userData.createdAt = performance.now();
    bullet.userData.lifespan = 2000; // Bullet lifespan in milliseconds
    bullet.userData.damage = this.damage; // Set bullet damage

    // Add bullet to scene and bullets array
    this.scene.add(bullet);
    this.bullets.push(bullet);

    // Add bullet trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, opacity: 0.5, transparent: true });

    const trailPositions = new Float32Array(2 * 3); // 2 points, 3 coordinates each
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    bullet.userData.trail = trail;
    this.scene.add(trail);
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
  }

  create() {
    // Create a gun group
    this.mesh = new THREE.Group();

    // Create gun body - make it longer and more substantial
    const bodyGeometry = new THREE.BoxGeometry(0.05, 0.08, 0.7);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.mesh.add(body);

    // Create scope - make it more visible
    const scopeGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 16);
    const scopeMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const scope = new THREE.Mesh(scopeGeometry, scopeMaterial);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.06, 0.1);
    this.mesh.add(scope);

    // Add scope lens (reflective material)
    const lensGeometry = new THREE.CircleGeometry(0.03, 16);
    const lensMaterial = new THREE.MeshPhongMaterial({
      color: 0x3333ff,
      shininess: 100,
      emissive: 0x222266
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(0, 0.06, 0.18);
    lens.rotation.y = Math.PI;
    this.mesh.add(lens);

    // Create gun handle - make it more ergonomic
    const handleGeometry = new THREE.BoxGeometry(0.04, 0.15, 0.04);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.1;
    handle.position.z = 0.2;
    this.mesh.add(handle);

    // Add stock
    const stockGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.2);
    const stockMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const stock = new THREE.Mesh(stockGeometry, stockMaterial);
    stock.position.z = 0.45;
    stock.position.y = -0.02;
    this.mesh.add(stock);

    // Add barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
    const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.2);
    this.mesh.add(barrel);

    // Position the gun in front of the camera
    this.mesh.position.set(0.3, -0.2, -0.5);
    this.camera.add(this.mesh);

    // Attach right-click event for zooming
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
      if (this.isZoomed) {
        this.endZoom();
      }
    };

    document.addEventListener('mousedown', onRightMouseDown);
    document.addEventListener('mouseup', onRightMouseUp);
    document.addEventListener('mouseleave', onMouseLeave);

    // Store the event listeners for cleanup
    this.zoomEventListeners = {
      down: onRightMouseDown,
      up: onRightMouseUp,
      leave: onMouseLeave
    };

    this.zoomEventAttached = true;
    console.log("Zoom events attached to sniper rifle");
  }

  cleanup() {
    // Remove zoom event listeners when switching weapons
    if (this.zoomEventAttached && this.zoomEventListeners) {
      document.removeEventListener('mousedown', this.zoomEventListeners.down);
      document.removeEventListener('mouseup', this.zoomEventListeners.up);
      document.removeEventListener('mouseleave', this.zoomEventListeners.leave);
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
    if (!this.isZoomed) return; // Not zoomed

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

      console.log("Updating FOV:", this.camera.fov, "Target:", this.targetFOV);
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

    // Add muzzle flash
    this.createMuzzleFlash(barrelTip, bulletDirection);

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
    }
  }
}

// Bazooka class
class Bazooka extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.shootCooldown = 2.0; // Very slow fire rate
    this.damage = 1000; // Extremely high damage - one-shot kills everything
    this.explosionRadius = 5; // Large explosion radius
    this.explosionForce = 20; // Strong explosion force
    this.rocketSpeed = 40; // Slower than bullets but still fast
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

    // Create rocket geometry
    const rocketBodyGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
    const rocketTipGeometry = new THREE.ConeGeometry(0.08, 0.15, 8);
    const rocketMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const rocketTipMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });

    const rocketGroup = new THREE.Group();

    const rocketBody = new THREE.Mesh(rocketBodyGeometry, rocketMaterial);
    rocketBody.rotation.x = Math.PI / 2;
    rocketGroup.add(rocketBody);

    const rocketTip = new THREE.Mesh(rocketTipGeometry, rocketTipMaterial);
    rocketTip.position.set(0, 0, 0.225);
    rocketTip.rotation.x = Math.PI / 2;
    rocketGroup.add(rocketTip);

    // Add fins
    const finGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.02);
    const finMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });

    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeometry, finMaterial);
      fin.position.set(
        Math.sin(i * Math.PI / 2) * 0.08,
        Math.cos(i * Math.PI / 2) * 0.08,
        -0.1
      );
      fin.rotation.z = i * Math.PI / 2;
      rocketGroup.add(fin);
    }

    // Get barrel position
    const barrelTip = new THREE.Vector3(0, 0, 1);
    this.mesh.updateMatrixWorld(true); // Make sure matrix is updated
    barrelTip.applyMatrix4(this.mesh.matrixWorld);

    // Set rocket position to start from the barrel
    rocketGroup.position.copy(barrelTip);

    // Set rocket direction based on camera direction
    const rocketDirection = new THREE.Vector3(0, 0, -1);
    rocketDirection.applyQuaternion(this.camera.quaternion);
    rocketGroup.userData.direction = rocketDirection;

    // Rotate rocket to face direction of travel
    rocketGroup.lookAt(rocketGroup.position.clone().add(rocketDirection));

    // Add rocket properties
    rocketGroup.userData.velocity = this.rocketSpeed;
    rocketGroup.userData.alive = true;
    rocketGroup.userData.createdAt = performance.now();
    rocketGroup.userData.lifespan = 10000; // 10 seconds
    rocketGroup.userData.damage = this.damage;
    rocketGroup.userData.isRocket = true;
    rocketGroup.userData.explosionRadius = this.explosionRadius;
    rocketGroup.userData.explosionForce = this.explosionForce;

    // Add rocket trail
    this.addRocketTrail(rocketGroup);

    // Add rocket to scene and bullets array
    this.scene.add(rocketGroup);
    this.bullets.push(rocketGroup);

    // Add strong recoil animation
    const originalPosition = this.mesh.position.clone();
    this.mesh.position.z += 0.3; // Strong recoil

    // Return to original position gradually
    setTimeout(() => {
      this.mesh.position.z = originalPosition.z + 0.2;
      setTimeout(() => {
        this.mesh.position.z = originalPosition.z + 0.1;
        setTimeout(() => {
          this.mesh.position.copy(originalPosition);
        }, 100);
      }, 100);
    }, 100);

    // Set shooting cooldown
    this.canShoot = false;
    setTimeout(() => {
      this.canShoot = true;
      console.log("Bazooka ready to fire again");
      // Auto-shoot if still holding mouse
      if (this.isMouseDown) {
        this.shoot();
      }
    }, this.shootCooldown * 1000);
  }

  addRocketTrail(rocket) {
    // Create particle system for rocket trail
    const particleCount = 100;
    const particles = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Initialize all particles at rocket position
    const rocketPos = rocket.position.clone();
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = rocketPos.x;
      positions[i * 3 + 1] = rocketPos.y;
      positions[i * 3 + 2] = rocketPos.z;

      // Color gradient from yellow to red to gray smoke
      const ratio = i / particleCount;
      if (ratio < 0.3) {
        // Yellow/orange
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.7 - ratio;
        colors[i * 3 + 2] = 0.0;
      } else {
        // Fade to gray smoke
        const smokeRatio = (ratio - 0.3) / 0.7;
        colors[i * 3] = 0.7 - smokeRatio * 0.4;
        colors[i * 3 + 1] = 0.7 - smokeRatio * 0.4;
        colors[i * 3 + 2] = 0.7 - smokeRatio * 0.4;
      }
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    const trail = new THREE.Points(particles, particleMaterial);
    this.scene.add(trail);

    // Store trail and its data in rocket
    rocket.userData.trail = trail;
    rocket.userData.trailPositions = positions;
    rocket.userData.trailColors = colors;
    rocket.userData.trailIndex = 0;
    rocket.userData.trailMaxParticles = particleCount;
    rocket.userData.lastTrailUpdateTime = performance.now();
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
}

// Export gun classes
window.GunSystem = {
  Gun,
  GatlingGun,
  Pistol,
  SniperRifle,
  Bazooka
}; 