import { Gun } from './Gun.js';

/**
 * SniperRifle class - a high damage, low fire rate precision rifle with zoom capability
 */
export class SniperRifle extends Gun {
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
    this.effects.playSound('shoot_sniper');

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

    // Add bullet trail using GunEffects utility
    this.effects.createBulletTrail(bullet, 0xff0000);

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
} 