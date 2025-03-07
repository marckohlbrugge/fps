import * as THREE from 'three';
import { Gun } from './Gun.js';

export class TranslocatorGun extends Gun {
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

    // Set flag
    this.isControllingProjectile = true;

    // Hide gun while controlling projectile
    if (this.mesh) {
      this.mesh.visible = false;
    }

    // Hide crosshair
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.style.display = 'none';
    }

    // Play transition sound
    this.playSound('transition');

    // Set flight start time
    this.flightStartTime = performance.now() / 1000;
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