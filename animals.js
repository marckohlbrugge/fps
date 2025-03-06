// Animal system for FPS game

class Animal {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.mesh = null;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3(
      Math.random() * 2 - 1,
      0,
      Math.random() * 2 - 1
    ).normalize();
    this.lastActionTime = 0;
    this.isMoving = false;
    this.health = 10;
    this.isDead = false;
  }

  create() {
    // Override in subclasses
  }

  update(delta, time, walls) {
    // Override in subclasses
  }

  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
  }
}

class Bunny extends Animal {
  constructor(scene, position) {
    super(scene, position);
    this.hopHeight = 0.5 + Math.random() * 0.3; // Random hop height
    this.hopSpeed = 2 + Math.random() * 1.5;    // Random hop speed
    this.hopInterval = 1 + Math.random() * 2;   // Random time between hops
    this.hopProgress = 0;
    this.bodyColor = 0xffffff;                  // White bunny
    this.earColor = 0xffcccc;                   // Pink ears
    this.noseColor = 0xff9999;                  // Pink nose
    this.scale = 0.3 + Math.random() * 0.2;     // Random size
    this.isHopping = false;
    this.restTime = 0;
    this.parts = {};

    // Create audio context for sounds
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.hasScreamed = false;
  }

  create() {
    // Create bunny group
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
    this.mesh.scale.set(this.scale, this.scale, this.scale);

    // Mark as bunny for collision detection
    this.mesh.userData.isBunny = true;
    this.mesh.userData.parent = this;

    // Create bunny body
    const bodyGeometry = new THREE.SphereGeometry(1, 16, 12);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: this.bodyColor });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.set(1, 0.8, 1.2);
    body.castShadow = true;
    this.mesh.add(body);
    this.parts.body = body;

    // Create bunny head
    const headGeometry = new THREE.SphereGeometry(0.6, 16, 12);
    const headMaterial = new THREE.MeshLambertMaterial({ color: this.bodyColor });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.4, 0.8);
    head.castShadow = true;
    this.mesh.add(head);
    this.parts.head = head;

    // Create bunny ears
    const earGeometry = new THREE.CylinderGeometry(0.1, 0.2, 1, 8);
    const earMaterial = new THREE.MeshLambertMaterial({ color: this.earColor });

    // Left ear
    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(-0.25, 1, 0.6);
    leftEar.rotation.x = -Math.PI / 8;
    leftEar.rotation.z = -Math.PI / 8;
    leftEar.castShadow = true;
    this.mesh.add(leftEar);
    this.parts.leftEar = leftEar;

    // Right ear
    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(0.25, 1, 0.6);
    rightEar.rotation.x = -Math.PI / 8;
    rightEar.rotation.z = Math.PI / 8;
    rightEar.castShadow = true;
    this.mesh.add(rightEar);
    this.parts.rightEar = rightEar;

    // Create bunny nose
    const noseGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const noseMaterial = new THREE.MeshLambertMaterial({ color: this.noseColor });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 0.3, 1.3);
    this.mesh.add(nose);
    this.parts.nose = nose;

    // Create bunny eyes
    const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.2, 0.5, 1.1);
    this.mesh.add(leftEye);
    this.parts.leftEye = leftEye;

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.2, 0.5, 1.1);
    this.mesh.add(rightEye);
    this.parts.rightEye = rightEye;

    // Create bunny tail
    const tailGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const tailMaterial = new THREE.MeshLambertMaterial({ color: this.bodyColor });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.4, -1);
    tail.castShadow = true;
    this.mesh.add(tail);
    this.parts.tail = tail;

    // Create bunny legs
    const legGeometry = new THREE.CylinderGeometry(0.15, 0.1, 0.5, 8);
    const legMaterial = new THREE.MeshLambertMaterial({ color: this.bodyColor });

    // Front left leg
    const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontLeftLeg.position.set(-0.4, -0.5, 0.5);
    frontLeftLeg.castShadow = true;
    this.mesh.add(frontLeftLeg);
    this.parts.frontLeftLeg = frontLeftLeg;

    // Front right leg
    const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontRightLeg.position.set(0.4, -0.5, 0.5);
    frontRightLeg.castShadow = true;
    this.mesh.add(frontRightLeg);
    this.parts.frontRightLeg = frontRightLeg;

    // Back left leg
    const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    backLeftLeg.position.set(-0.4, -0.5, -0.5);
    backLeftLeg.castShadow = true;
    this.mesh.add(backLeftLeg);
    this.parts.backLeftLeg = backLeftLeg;

    // Back right leg
    const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    backRightLeg.position.set(0.4, -0.5, -0.5);
    backRightLeg.castShadow = true;
    this.mesh.add(backRightLeg);
    this.parts.backRightLeg = backRightLeg;

    // Add to scene
    this.scene.add(this.mesh);

    return this.mesh;
  }

  update(delta, time, walls) {
    if (this.isDead) return;

    // Decide whether to hop or rest
    if (!this.isHopping && time - this.lastActionTime > this.restTime) {
      // Time to start a new hop
      this.startHop();
      this.lastActionTime = time;
    } else if (this.isHopping) {
      // Continue hopping
      this.updateHop(delta);
    }

    // Check for collisions and adjust direction
    this.checkCollisions(walls);

    // Wiggle ears and tail for cuteness
    this.animateParts(time);
  }

  startHop() {
    this.isHopping = true;
    this.hopProgress = 0;

    // Choose a new random direction occasionally
    if (Math.random() < 0.3) {
      this.direction.set(
        Math.random() * 2 - 1,
        0,
        Math.random() * 2 - 1
      ).normalize();
    }

    // Rotate bunny to face hop direction
    this.mesh.rotation.y = Math.atan2(this.direction.x, this.direction.z);

    // Prepare legs for hopping
    this.parts.frontLeftLeg.rotation.x = -Math.PI / 4;
    this.parts.frontRightLeg.rotation.x = -Math.PI / 4;
    this.parts.backLeftLeg.rotation.x = Math.PI / 6;
    this.parts.backRightLeg.rotation.x = Math.PI / 6;
  }

  updateHop(delta) {
    // Progress the hop
    this.hopProgress += delta * this.hopSpeed;

    if (this.hopProgress >= 1) {
      // Hop complete
      this.isHopping = false;
      this.restTime = this.hopInterval * (0.5 + Math.random());
      this.mesh.position.y = this.position.y;

      // Reset leg positions
      this.parts.frontLeftLeg.rotation.x = 0;
      this.parts.frontRightLeg.rotation.x = 0;
      this.parts.backLeftLeg.rotation.x = 0;
      this.parts.backRightLeg.rotation.x = 0;

      return;
    }

    // Calculate hop height using sine wave
    const hopHeight = Math.sin(this.hopProgress * Math.PI) * this.hopHeight;

    // Calculate forward movement (more at the beginning of the hop)
    const hopDistance = delta * this.hopSpeed * 2 * (1 - Math.abs(this.hopProgress - 0.5) * 1.5);

    // Apply movement
    this.mesh.position.add(this.direction.clone().multiplyScalar(hopDistance));
    this.mesh.position.y = this.position.y + hopHeight;

    // Update position
    this.position.copy(this.mesh.position);
    this.position.y = this.position.y - hopHeight; // Store base position without hop height
  }

  checkCollisions(walls) {
    // Create a sphere for collision detection
    const bunnyRadius = 1 * this.scale;
    const bunnySphere = new THREE.Sphere(this.mesh.position, bunnyRadius);

    // Check collision with each wall
    for (const wall of walls) {
      // Skip destroyed walls
      if (wall.userData.destroyed) continue;

      // Skip non-solid objects
      if (wall.userData.isPassable) continue;

      // Get wall's bounding box
      const wallBox = new THREE.Box3().setFromObject(wall);

      // Check if bunny sphere intersects with wall box
      if (wallBox.intersectsSphere(bunnySphere)) {
        // Reverse direction and add some randomness
        this.direction.negate();
        this.direction.x += (Math.random() * 0.4 - 0.2);
        this.direction.z += (Math.random() * 0.4 - 0.2);
        this.direction.normalize();

        // Move away from wall slightly to prevent getting stuck
        this.mesh.position.add(this.direction.clone().multiplyScalar(0.2));
        this.position.copy(this.mesh.position);
        this.position.y = this.position.y - (this.isHopping ? Math.sin(this.hopProgress * Math.PI) * this.hopHeight : 0);

        break;
      }
    }

    // Keep bunnies within bounds
    const boundarySize = 100;
    if (Math.abs(this.mesh.position.x) > boundarySize || Math.abs(this.mesh.position.z) > boundarySize) {
      // Turn back toward center
      this.direction.set(
        -this.mesh.position.x / boundarySize,
        0,
        -this.mesh.position.z / boundarySize
      ).normalize();
    }
  }

  animateParts(time) {
    // Wiggle ears
    const earWiggle = Math.sin(time * 3) * 0.05;
    this.parts.leftEar.rotation.z = -Math.PI / 8 + earWiggle;
    this.parts.rightEar.rotation.z = Math.PI / 8 - earWiggle;

    // Wiggle tail
    const tailWiggle = Math.sin(time * 5) * 0.1;
    this.parts.tail.scale.set(
      1 + tailWiggle,
      1 - tailWiggle,
      1 + tailWiggle
    );
  }

  playSound(type) {
    // Create oscillators for bunny sounds
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    if (type === 'scream') {
      // Bunny scream sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.3);

      // Volume envelope
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

      // Play and stop
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } else if (type === 'hop') {
      // Bunny hop sound (subtle)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(700, this.audioContext.currentTime + 0.05);

      // Volume envelope (very quiet)
      gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

      // Play and stop
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
    }
  }

  takeDamage(damage) {
    this.health -= damage;

    // Create blood at the bunny's position
    this.createBloodSplatter();

    if (this.health <= 0 && !this.isDead) {
      this.die();
    } else {
      // Play hurt sound if not dead yet
      this.playSound('scream');
    }
  }

  createBloodSplatter() {
    if (!window.particles) {
      window.particles = [];
    }

    // Create blood particles
    const particleCount = 10;

    for (let i = 0; i < particleCount; i++) {
      // Create particle
      const size = 0.02 + Math.random() * 0.03;
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Red blood
        transparent: true,
        opacity: 0.9
      });

      const particle = new THREE.Mesh(geometry, material);

      // Position at bunny
      particle.position.copy(this.mesh.position);
      particle.position.y += 0.2; // Slightly above ground

      // Add random offset
      particle.position.x += (Math.random() - 0.5) * 0.5;
      particle.position.z += (Math.random() - 0.5) * 0.5;

      // Set velocity - spray upward and outward
      const angle = Math.random() * Math.PI * 2;
      const height = Math.random() * 0.5 + 0.2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * (Math.random() + 0.5),
        height,
        Math.sin(angle) * (Math.random() + 0.5)
      );

      particle.userData.velocity = velocity;
      particle.userData.createdAt = performance.now();
      particle.userData.lifespan = 800 + Math.random() * 400; // 0.8-1.2 seconds

      this.scene.add(particle);
      window.particles.push(particle);
    }
  }

  die() {
    this.isDead = true;

    // Play death scream
    if (!this.hasScreamed) {
      this.playSound('scream');
      this.hasScreamed = true;
    }

    // Create a large blood pool
    this.createBloodPool();

    // Tip over
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.y = this.position.y - 0.5 * this.scale;

    // Change color slightly
    this.parts.body.material.color.set(0xeeeeee);
    this.parts.head.material.color.set(0xeeeeee);

    // Remove after a while
    setTimeout(() => {
      this.destroy();

      // Remove from global array if it exists
      if (window.bunnies) {
        const index = window.bunnies.indexOf(this);
        if (index !== -1) {
          window.bunnies.splice(index, 1);
        }
      }
    }, 10000); // Remove after 10 seconds
  }

  createBloodPool() {
    // Create a blood pool on the ground
    const poolRadius = 0.5 + Math.random() * 0.3;
    const poolGeometry = new THREE.CircleGeometry(poolRadius, 16);
    const poolMaterial = new THREE.MeshBasicMaterial({
      color: 0xaa0000, // Darker red for blood pool
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    const bloodPool = new THREE.Mesh(poolGeometry, poolMaterial);
    bloodPool.rotation.x = -Math.PI / 2; // Lay flat on ground
    bloodPool.position.copy(this.mesh.position);
    bloodPool.position.y = 0.01; // Just above ground to avoid z-fighting

    this.scene.add(bloodPool);

    // Animate the blood pool growing
    const startScale = 0.2;
    bloodPool.scale.set(startScale, startScale, startScale);

    // Grow the pool over time
    const growDuration = 2000; // 2 seconds
    const startTime = performance.now();

    const growPool = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / growDuration, 1);

      // Ease out cubic: progress = 1 - Math.pow(1 - progress, 3);
      const eased = 1 - Math.pow(1 - progress, 3);
      const newScale = startScale + (1 - startScale) * eased;

      bloodPool.scale.set(newScale, newScale, newScale);

      if (progress < 1) {
        requestAnimationFrame(growPool);
      }
    };

    growPool();

    // Add to particles array for cleanup
    if (!window.particles) {
      window.particles = [];
    }

    // Add custom properties for cleanup
    bloodPool.userData.createdAt = performance.now();
    bloodPool.userData.lifespan = 15000; // 15 seconds
    bloodPool.userData.isBloodPool = true;

    window.particles.push(bloodPool);
  }
}

// Export animal classes
window.AnimalSystem = {
  Animal,
  Bunny
}; 