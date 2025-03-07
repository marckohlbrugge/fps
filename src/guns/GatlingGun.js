import { Gun } from './Gun.js';

/**
 * Gatling Gun class - a rapid-fire multi-barrel machine gun
 */
export class GatlingGun extends Gun {
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

  // Override createImpactEffect to create more particles for Gatling Gun hits
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

    // Gatling gun creates more particles for dramatic effect
    const particleCount = 10;

    // Rest of the method is the same as the parent Gun class
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
} 