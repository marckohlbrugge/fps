// Enemy system for FPS game

// Define the Enemy class that extends Animal
class Enemy extends Animal {
  constructor(scene, position, camera) {
    super(scene, position);
    this.camera = camera;
    this.health = 50;
    this.attackRange = 20; // Range at which enemy will shoot at player
    this.detectionRange = 30; // Range at which enemy will detect player
    this.shootInterval = 2000; // Time between shots in milliseconds
    this.lastShootTime = 0;
    this.damage = 10; // Damage per shot
    this.accuracy = 0.8; // Accuracy of shots (0-1)
    this.moveSpeed = 1.5; // Movement speed
    this.rotationSpeed = 2; // How fast the enemy turns
    this.parts = {};
    this.bulletSpeed = 20;
    this.bullets = [];
    this.isAggressive = true; // Whether the enemy is currently aggressive
    this.bulletSize = 0.1;
    this.bulletColor = 0xff0000; // Red bullets

    // Audio for enemy
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.sounds = {
      shoot: null,
      hit: null,
      death: null
    };
  }

  create() {
    // Create enemy mesh group
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    // Create enemy body (torso)
    const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.5;
    body.castShadow = true;
    this.mesh.add(body);
    this.parts.body = body;

    // Create enemy head
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.5;
    head.castShadow = true;
    this.mesh.add(head);
    this.parts.head = head;

    // Create enemy eyes (glowing red)
    const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 2.5, 0.3);
    this.mesh.add(leftEye);
    this.parts.leftEye = leftEye;

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 2.5, 0.3);
    this.mesh.add(rightEye);
    this.parts.rightEye = rightEye;

    // Create enemy arms
    const armGeometry = new THREE.BoxGeometry(0.25, 1, 0.25);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.6, 1.5, 0);
    leftArm.castShadow = true;
    this.mesh.add(leftArm);
    this.parts.leftArm = leftArm;

    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.6, 1.5, 0);
    rightArm.castShadow = true;
    this.mesh.add(rightArm);
    this.parts.rightArm = rightArm;

    // Create enemy gun
    const gunGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.6);
    const gunMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const gun = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.position.set(0.6, 1.5, 0.4);
    this.mesh.add(gun);
    this.parts.gun = gun;

    // Create enemy legs
    const legGeometry = new THREE.BoxGeometry(0.35, 1, 0.35);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

    // Left leg
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.25, 0.5, 0);
    leftLeg.castShadow = true;
    this.mesh.add(leftLeg);
    this.parts.leftLeg = leftLeg;

    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.25, 0.5, 0);
    rightLeg.castShadow = true;
    this.mesh.add(rightLeg);
    this.parts.rightLeg = rightLeg;

    return this.mesh;
  }

  update(delta, time, walls) {
    if (this.isDead) return;

    // Get player position (camera position)
    const playerPosition = this.camera.position.clone();

    // Calculate distance to player
    const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

    // Direction to player
    const directionToPlayer = new THREE.Vector3()
      .subVectors(playerPosition, this.mesh.position)
      .normalize();

    // Check if player is in detection range
    if (distanceToPlayer < this.detectionRange) {
      // Rotate towards player
      this.rotateTowards(directionToPlayer, delta);

      // Move towards player if not in attack range
      if (distanceToPlayer > this.attackRange / 2) {
        // Move towards player
        const moveDistance = this.moveSpeed * delta;
        this.mesh.position.add(directionToPlayer.clone().multiplyScalar(moveDistance));

        // Animate walking
        this.animateWalking(time);
      } else {
        // Reset walking animation
        this.resetWalkingAnimation();
      }

      // Shoot at player if in attack range
      if (distanceToPlayer < this.attackRange) {
        this.tryShoot(time);
      }
    }

    // Update bullets
    this.updateBullets(delta, walls);

    // Check for collisions with walls
    this.checkCollisions(walls);

    // Ensure enemy is on the ground
    if (this.mesh.position.y > 0.5) {
      this.mesh.position.y = 0.5;
    }
  }

  rotateTowards(direction, delta) {
    // Calculate target rotation
    const targetRotation = Math.atan2(direction.x, direction.z);

    // Current rotation
    const currentRotation = this.mesh.rotation.y;

    // Calculate shortest angle difference
    let angleDiff = targetRotation - currentRotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Rotate towards target with smooth interpolation
    const rotationAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.rotationSpeed * delta);
    this.mesh.rotation.y += rotationAmount;
  }

  animateWalking(time) {
    // Simple walking animation
    const legSwing = Math.sin(time * 5) * 0.2;
    this.parts.leftLeg.rotation.x = legSwing;
    this.parts.rightLeg.rotation.x = -legSwing;

    // Arm swing
    this.parts.leftArm.rotation.x = -legSwing;
    this.parts.rightArm.rotation.x = legSwing;
  }

  resetWalkingAnimation() {
    this.parts.leftLeg.rotation.x = 0;
    this.parts.rightLeg.rotation.x = 0;
    this.parts.leftArm.rotation.x = 0;
    this.parts.rightArm.rotation.x = 0;
  }

  tryShoot(time) {
    // Check if enough time has passed since last shot
    if (time - this.lastShootTime > this.shootInterval / 1000) { // Convert milliseconds to seconds
      this.shoot();
      this.lastShootTime = time;
    }
  }

  shoot() {
    // Get gun position and direction
    const gunPosition = new THREE.Vector3();
    this.parts.gun.getWorldPosition(gunPosition);

    // Direction is forward from the enemy's perspective with some randomness for accuracy
    const direction = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(this.mesh.quaternion)
      .normalize();

    // Add inaccuracy
    if (this.accuracy < 1) {
      const inaccuracy = (1 - this.accuracy) * 0.2;
      direction.x += (Math.random() - 0.5) * inaccuracy;
      direction.y += (Math.random() - 0.5) * inaccuracy;
      direction.z += (Math.random() - 0.5) * inaccuracy;
      direction.normalize();
    }

    // Create bullet
    this.createBullet(gunPosition, direction);

    // Play shoot sound
    this.playSound('shoot');

    // Create muzzle flash
    this.createMuzzleFlash(gunPosition, direction);

    console.log("Enemy shooting at player!");
  }

  createBullet(position, direction) {
    // Create bullet geometry and material
    const bulletGeometry = new THREE.SphereGeometry(this.bulletSize, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: this.bulletColor });

    // Create bullet mesh
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(position);

    // Add bullet to scene
    this.scene.add(bullet);

    // Store bullet data
    bullet.userData = {
      velocity: direction.clone().multiplyScalar(this.bulletSpeed),
      damage: this.damage,
      lifetime: 0,
      maxLifetime: 5 // Seconds before bullet is removed
    };

    // Add to bullets array
    this.bullets.push(bullet);

    return bullet;
  }

  updateBullets(delta, walls) {
    // Update each bullet
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      // Update bullet position
      bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(delta));

      // Update lifetime
      bullet.userData.lifetime += delta;

      // Check if bullet has exceeded max lifetime
      if (bullet.userData.lifetime > bullet.userData.maxLifetime) {
        // Remove bullet
        this.scene.remove(bullet);
        this.bullets.splice(i, 1);
        continue;
      }

      // Check for collisions with walls
      const collision = this.checkBulletCollisions(bullet, walls);
      if (collision) {
        // Remove bullet
        this.scene.remove(bullet);
        this.bullets.splice(i, 1);
        continue;
      }

      // Check for collision with player
      if (this.checkBulletPlayerCollision(bullet)) {
        // Remove bullet
        this.scene.remove(bullet);
        this.bullets.splice(i, 1);
      }
    }
  }

  checkBulletCollisions(bullet, walls) {
    if (!walls || !walls.length) return false;

    // Create a small raycaster from bullet's previous position to current position
    const raycaster = new THREE.Raycaster();

    // Calculate previous position (approximation)
    const prevPosition = bullet.position.clone().sub(
      bullet.userData.velocity.clone().multiplyScalar(0.016) // Assuming 60fps
    );

    raycaster.set(prevPosition, bullet.userData.velocity.clone().normalize());

    // Calculate distance to travel
    const distanceToTravel = prevPosition.distanceTo(bullet.position);

    // Check for intersections with walls
    const intersects = raycaster.intersectObjects(walls);

    if (intersects.length > 0 && intersects[0].distance < distanceToTravel) {
      // Bullet hit a wall
      const hitPoint = intersects[0].point;
      const normal = intersects[0].face.normal;

      // Create impact effect
      this.createImpactEffect(hitPoint, normal);

      return true;
    }

    return false;
  }

  checkBulletPlayerCollision(bullet) {
    // Get player position (camera position)
    const playerPosition = this.camera.position.clone();

    // Simple sphere collision detection
    const playerRadius = 0.5; // Approximate player collision radius
    const distance = bullet.position.distanceTo(playerPosition);

    if (distance < playerRadius + this.bulletSize) {
      // Bullet hit player

      // Apply damage to player (if the game has a player health system)
      if (window.playerHealth !== undefined) {
        window.playerHealth -= bullet.userData.damage;
        console.log("Player hit! Health: " + window.playerHealth);

        // Check if player is dead
        if (window.playerHealth <= 0) {
          // Player is dead
          console.log("Player died!");
          // You could add game over logic here
        }
      }

      // Create blood effect
      this.createBloodEffect(playerPosition);

      // Shake camera
      if (window.shakeCamera) {
        window.shakeCamera(0.5);
      }

      return true;
    }

    return false;
  }

  createImpactEffect(position, normal) {
    // Create impact particles
    const particleCount = 5;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      // Create particle
      const size = 0.02 + Math.random() * 0.03;
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Yellow sparks
        transparent: true,
        opacity: 0.8
      });

      const particle = new THREE.Mesh(geometry, material);

      // Position at impact point
      particle.position.copy(position);

      // Add random velocity in hemisphere around normal
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );

      // Make sure velocity is in hemisphere of normal
      if (velocity.dot(normal) < 0) {
        velocity.reflect(normal);
      }

      // Scale velocity
      velocity.multiplyScalar(2 + Math.random() * 3);

      // Add to particle data
      particle.userData = {
        velocity: velocity,
        lifetime: 0,
        maxLifetime: 0.5 + Math.random() * 0.5
      };

      // Add to scene
      this.scene.add(particle);
      particles.push(particle);
    }

    // Add particles to global particles array if it exists
    if (window.particles) {
      window.particles.push(...particles);
    }
  }

  createBloodEffect(position) {
    // Create blood particles
    const particleCount = 10;
    const particles = [];

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

      // Position at impact point
      particle.position.copy(position);

      // Add random velocity in all directions
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );

      // Scale velocity
      velocity.multiplyScalar(1 + Math.random() * 2);

      // Add to particle data
      particle.userData = {
        velocity: velocity,
        lifetime: 0,
        maxLifetime: 0.5 + Math.random() * 0.5
      };

      // Add to scene
      this.scene.add(particle);
      particles.push(particle);
    }

    // Add particles to global particles array if it exists
    if (window.particles) {
      window.particles.push(...particles);
    }
  }

  createMuzzleFlash(position, direction) {
    // Create muzzle flash light
    const light = new THREE.PointLight(0xffaa00, 1, 3);
    light.position.copy(position);
    this.scene.add(light);

    // Remove light after a short time
    setTimeout(() => {
      this.scene.remove(light);
    }, 50);
  }

  takeDamage(damage) {
    if (this.isDead) return;

    this.health -= damage;

    // Play hit sound
    this.playSound('hit');

    // Check if enemy is dead
    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    if (this.isDead) return;

    this.isDead = true;

    // Play death sound
    this.playSound('death');

    // Create death effect
    this.createDeathEffect();

    // Spawn two new enemies when this one dies
    if (typeof window.spawnEnemiesOnDeath === 'function') {
      window.spawnEnemiesOnDeath(2);
    }

    // Remove from scene after a delay
    setTimeout(() => {
      this.destroy();

      // Remove from enemies array if it exists
      if (window.enemies) {
        const index = window.enemies.indexOf(this);
        if (index !== -1) {
          window.enemies.splice(index, 1);
        }
      }
    }, 5000);
  }

  createDeathEffect() {
    // Make enemy fall over
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.5;

    // Create blood pool
    this.createBloodPool();
  }

  createBloodPool() {
    // Create blood pool
    const poolGeometry = new THREE.CircleGeometry(1, 16);
    const poolMaterial = new THREE.MeshBasicMaterial({
      color: 0xaa0000,
      transparent: true,
      opacity: 0.7
    });

    const pool = new THREE.Mesh(poolGeometry, poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.copy(this.mesh.position);
    pool.position.y = 0.01; // Just above ground
    this.scene.add(pool);

    // Grow pool over time
    let scale = 0.1;
    const maxScale = 1 + Math.random() * 0.5;

    const growPool = () => {
      scale += 0.05;
      pool.scale.set(scale, scale, scale);

      if (scale < maxScale) {
        requestAnimationFrame(growPool);
      }
    };

    growPool();
  }

  checkCollisions(walls) {
    if (!walls || !walls.length) return;

    // Simple collision detection with walls
    for (const wall of walls) {
      if (!wall.geometry) continue;

      // Create bounding boxes
      const enemyBox = new THREE.Box3().setFromObject(this.mesh);
      const wallBox = new THREE.Box3().setFromObject(wall);

      // Check for collision
      if (enemyBox.intersectsBox(wallBox)) {
        // Move away from wall
        const enemyCenter = enemyBox.getCenter(new THREE.Vector3());
        const wallCenter = wallBox.getCenter(new THREE.Vector3());

        const direction = new THREE.Vector3()
          .subVectors(enemyCenter, wallCenter)
          .normalize();

        // Move enemy away from wall
        this.mesh.position.add(direction.multiplyScalar(0.1));
      }
    }
  }

  playSound(type) {
    // Create and play sound
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    switch (type) {
      case 'shoot':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        break;

      case 'hit':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
        break;

      case 'death':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(55, this.audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);
        break;
    }
  }
}

// Create a namespace for the enemy system
const EnemySystem = {
  Enemy: Enemy
};

// Make the enemy system available globally
window.EnemySystem = EnemySystem; 