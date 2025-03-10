import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { Gun } from './Gun.js';

/**
 * Bazooka class - a high damage, low fire rate rocket launcher with explosive projectiles
 */
export class Bazooka extends Gun {
  constructor(scene, camera) {
    super(scene, camera);
    this.name = "Bazooka";
    this.damage = 100;
    this.reloadTime = 2000; // 2 seconds
    this.lastShootTime = 0;
    this.canShoot = true;
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
    this.effects.playSound('shoot');

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

    // Add muzzle flash
    this.effects.createMuzzleFlash(barrelTip, rocketDirection);

    // Set cooldown
    this.canShoot = false;
    setTimeout(() => {
      this.canShoot = true;
    }, this.reloadTime);
  }

  createRocketTrail(rocket) {
    // Create a trail using particles
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.PointsMaterial({
      color: 0xff4400,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    // Create trail particles
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);

    // Initialize all particles at rocket position
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = rocket.position.x;
      positions[i * 3 + 1] = rocket.position.y;
      positions[i * 3 + 2] = rocket.position.z;
    }

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const trail = new THREE.Points(trailGeometry, trailMaterial);
    this.scene.add(trail);

    // Store trail data in rocket
    rocket.userData.trail = trail;
    rocket.userData.trailPositions = positions;
    rocket.userData.trailIndex = 0;
    rocket.userData.lastTrailUpdate = performance.now();

    return trail;
  }

  updateRocketTrail(rocket, delta) {
    const currentTime = performance.now();
    const timeSinceLastUpdate = currentTime - rocket.userData.lastTrailUpdate;

    // Update trail every 16ms (approximately 60fps)
    if (timeSinceLastUpdate >= 16) {
      const positions = rocket.userData.trailPositions;
      const count = positions.length / 3;

      // Shift all particles back
      for (let i = count - 1; i > 0; i--) {
        positions[i * 3] = positions[(i - 1) * 3];
        positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
      }

      // Set first particle to rocket position
      positions[0] = rocket.position.x;
      positions[1] = rocket.position.y;
      positions[2] = rocket.position.z;

      rocket.userData.trail.geometry.attributes.position.needsUpdate = true;
      rocket.userData.lastTrailUpdate = currentTime;
    }
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
    this.effects.playSound('explosion');

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

  // Override the parent class's checkBulletCollisions to use enhanced explosion
  checkBulletCollisions(bullet, walls) {
    const collision = super.checkBulletCollisions(bullet, walls);
    if (collision && bullet.userData.isRocket) {
      this.effects.createEnhancedExplosion(
        bullet.position.clone(),
        bullet.userData.explosionRadius,
        bullet.userData.explosionForce
      );
    }
    return collision;
  }
} 