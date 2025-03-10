import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { Gun } from './Gun.js';

export class Akimbo extends Gun {
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
    this.effects.playSound('shoot_akimbo');

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

    // Add bullet trail using GunEffects utility
    this.effects.createBulletTrail(bullet, 0xff9900);
  }
} 