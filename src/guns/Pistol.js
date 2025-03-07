import { Gun } from './Gun.js';

/**
 * Pistol class - a medium damage, medium fire rate handgun
 */
export class Pistol extends Gun {
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
    this.effects.playSound('shoot_pistol');

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

    // Add bullet trail using GunEffects utility
    this.effects.createBulletTrail(bullet, 0xff6600);

    // Add recoil animation
    const originalPosition = this.mesh.position.clone();
    this.mesh.position.z += 0.05; // Move gun backward

    // Return to original position
    setTimeout(() => {
      this.mesh.position.copy(originalPosition);
    }, 100);
  }
} 