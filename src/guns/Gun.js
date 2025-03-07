import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { GunEffects } from '../utils/GunEffects.js';
import { getAudioContext, initializeAudio } from '../utils/AudioManager.js';

// Initialize audio system
initializeAudio();

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

    // Use the shared audio context
    this.audioContext = getAudioContext();

    // Initialize gun effects
    this.effects = new GunEffects(scene, this.audioContext);
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
        this.effects.createExplosion(bullet.position.clone(), bullet.userData.explosionRadius, bullet.userData.explosionForce);
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
      this.effects.createImpactEffect(intersects[0].point, intersects[0].face.normal, hitObject);

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
          this.effects.createImpactEffect(
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
      this.effects.createImpactEffect(
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
    this.effects.createExplosion(object.position, 2, 10); // Using explosion effect for destruction

    // Remove all impact markers (bullet holes) associated with this object
    this.removeImpactMarkers(object);

    // Remove the object from the scene
    this.scene.remove(object);

    // Remove from walls array if it's there
    if (window.walls) {
      const wallIndex = window.walls.indexOf(object);
      if (wallIndex !== -1) {
        window.walls.splice(wallIndex, 1);
        console.log("Wall destroyed and removed from collision detection!");
      }
    } else {
      console.log("Wall destroyed, but couldn't access walls array directly.");
      object.userData.destroyed = true;
    }
  }

  // Remove all impact markers associated with an object
  removeImpactMarkers(object) {
    if (!window.impactMarkers) {
      window.impactMarkers = [];
      return;
    }

    for (let i = window.impactMarkers.length - 1; i >= 0; i--) {
      const marker = window.impactMarkers[i];
      if (marker.userData.parentObject === object) {
        this.scene.remove(marker);
        window.impactMarkers.splice(i, 1);
      }
    }
  }

  // Play sound effects
  playSound(type) {
    this.effects.playSound(type);
  }

  // Create muzzle flash effect
  createMuzzleFlash(position, direction) {
    this.effects.createMuzzleFlash(position, direction);
  }

  // Create impact mark (bullet hole)
  createImpactMark(position, normal, hitObject) {
    this.effects.createImpactMark(position, normal, hitObject);
  }

  // Shake camera effect
  shakeCamera(intensity) {
    const originalPosition = this.camera.position.clone();
    const originalRotation = this.camera.rotation.clone();
    let time = 0;
    const duration = 200; // Duration in milliseconds
    const startTime = performance.now();

    const shake = () => {
      time = performance.now() - startTime;
      if (time < duration) {
        // Calculate shake offset
        const offsetX = (Math.random() - 0.5) * intensity;
        const offsetY = (Math.random() - 0.5) * intensity;
        const offsetZ = (Math.random() - 0.5) * intensity;

        // Apply offset to camera position
        this.camera.position.set(
          originalPosition.x + offsetX,
          originalPosition.y + offsetY,
          originalPosition.z + offsetZ
        );

        // Apply slight rotation shake
        this.camera.rotation.set(
          originalRotation.x + (Math.random() - 0.5) * 0.1 * intensity,
          originalRotation.y + (Math.random() - 0.5) * 0.1 * intensity,
          originalRotation.z + (Math.random() - 0.5) * 0.1 * intensity
        );

        requestAnimationFrame(shake);
      } else {
        // Reset to original position and rotation
        this.camera.position.copy(originalPosition);
        this.camera.rotation.copy(originalRotation);
      }
    };

    shake();
  }
} 