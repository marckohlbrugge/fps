// Building system for FPS game

class Building {
  constructor(scene, position, dimensions, options = {}) {
    this.scene = scene;
    this.position = position;
    this.dimensions = dimensions; // {width, height, depth}
    this.options = Object.assign({
      color: 0xaaaaaa,
      windowColor: 0x88ccff,
      roofColor: 0x884422,
      hasRoof: true,
      floors: 1,
      windows: true,
      doors: true,
      health: 1000,
      destructible: true
    }, options);

    this.mesh = null;
    this.parts = [];
    this.colliders = [];
    this.interiorSpaces = [];
  }

  create() {
    // Create building group
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);

    // Create the main structure
    this.createWalls();

    if (this.options.hasRoof) {
      this.createRoof();
    }

    if (this.options.windows) {
      this.createWindows();
    }

    if (this.options.doors) {
      this.createDoors();
    }

    // Create interior spaces
    this.createInterior();

    // Add building to scene
    this.scene.add(this.mesh);

    // Add building parts to collision detection
    this.addToCollisionSystem();

    return this.mesh;
  }

  createWalls() {
    const { width, height, depth } = this.dimensions;
    const wallThickness = 0.2;
    const floorHeight = height / this.options.floors;

    // Create exterior walls
    for (let floor = 0; floor < this.options.floors; floor++) {
      const floorY = floor * floorHeight;

      // Front wall
      this.createWall({
        width: width,
        height: floorHeight,
        depth: wallThickness,
        position: new THREE.Vector3(0, floorY + floorHeight / 2, depth / 2),
        rotation: new THREE.Vector3(0, 0, 0)
      });

      // Back wall
      this.createWall({
        width: width,
        height: floorHeight,
        depth: wallThickness,
        position: new THREE.Vector3(0, floorY + floorHeight / 2, -depth / 2),
        rotation: new THREE.Vector3(0, Math.PI, 0)
      });

      // Left wall
      this.createWall({
        width: depth,
        height: floorHeight,
        depth: wallThickness,
        position: new THREE.Vector3(-width / 2, floorY + floorHeight / 2, 0),
        rotation: new THREE.Vector3(0, Math.PI / 2, 0)
      });

      // Right wall
      this.createWall({
        width: depth,
        height: floorHeight,
        depth: wallThickness,
        position: new THREE.Vector3(width / 2, floorY + floorHeight / 2, 0),
        rotation: new THREE.Vector3(0, -Math.PI / 2, 0)
      });

      // Floor (except for ground floor)
      if (floor > 0) {
        this.createFloor({
          width: width - wallThickness * 2,
          depth: depth - wallThickness * 2,
          position: new THREE.Vector3(0, floorY, 0)
        });
      }
    }
  }

  createWall(params) {
    const geometry = new THREE.BoxGeometry(params.width, params.height, params.depth);
    const material = new THREE.MeshLambertMaterial({ color: this.options.color });
    const wall = new THREE.Mesh(geometry, material);

    wall.position.copy(params.position);
    wall.rotation.setFromVector3(params.rotation);

    wall.castShadow = true;
    wall.receiveShadow = true;

    // Add health and other properties
    wall.userData.health = this.options.health;
    wall.userData.destructible = this.options.destructible;
    wall.userData.isBuilding = true;
    wall.userData.buildingPart = 'wall';
    wall.userData.parentBuilding = this; // Reference to parent building

    this.mesh.add(wall);
    this.parts.push(wall);
    this.colliders.push(wall);

    return wall;
  }

  createFloor(params) {
    const geometry = new THREE.BoxGeometry(params.width, 0.1, params.depth);
    const material = new THREE.MeshLambertMaterial({ color: this.options.color });
    const floor = new THREE.Mesh(geometry, material);

    floor.position.copy(params.position);
    floor.receiveShadow = true;

    floor.userData.isBuilding = true;
    floor.userData.buildingPart = 'floor';

    this.mesh.add(floor);
    this.parts.push(floor);
    this.colliders.push(floor);

    return floor;
  }

  createRoof() {
    const { width, height, depth } = this.dimensions;
    const roofHeight = 0.1;

    const geometry = new THREE.BoxGeometry(width, roofHeight, depth);
    const material = new THREE.MeshLambertMaterial({ color: this.options.roofColor });
    const roof = new THREE.Mesh(geometry, material);

    roof.position.set(0, height, 0);
    roof.castShadow = true;
    roof.receiveShadow = true;

    roof.userData.health = this.options.health;
    roof.userData.destructible = this.options.destructible;
    roof.userData.isBuilding = true;
    roof.userData.buildingPart = 'roof';

    this.mesh.add(roof);
    this.parts.push(roof);
    this.colliders.push(roof);
  }

  createWindows() {
    const { width, height, depth } = this.dimensions;
    const floorHeight = height / this.options.floors;
    const windowWidth = 1.2;
    const windowHeight = 1.0;
    const windowDepth = 0.05;
    const windowsPerWall = Math.floor(width / 3);

    for (let floor = 0; floor < this.options.floors; floor++) {
      const floorY = floor * floorHeight;
      const windowY = floorY + floorHeight / 2;

      // Front windows
      for (let i = 0; i < windowsPerWall; i++) {
        const windowX = (i - (windowsPerWall - 1) / 2) * (width / windowsPerWall);
        this.createWindow({
          width: windowWidth,
          height: windowHeight,
          depth: windowDepth,
          position: new THREE.Vector3(windowX, windowY, depth / 2 + 0.01),
          rotation: new THREE.Vector3(0, 0, 0)
        });
      }

      // Back windows
      for (let i = 0; i < windowsPerWall; i++) {
        const windowX = (i - (windowsPerWall - 1) / 2) * (width / windowsPerWall);
        this.createWindow({
          width: windowWidth,
          height: windowHeight,
          depth: windowDepth,
          position: new THREE.Vector3(windowX, windowY, -depth / 2 - 0.01),
          rotation: new THREE.Vector3(0, Math.PI, 0)
        });
      }

      // Side windows (fewer)
      const sideWindowsCount = Math.floor(depth / 3);

      // Left windows
      for (let i = 0; i < sideWindowsCount; i++) {
        const windowZ = (i - (sideWindowsCount - 1) / 2) * (depth / sideWindowsCount);
        this.createWindow({
          width: windowWidth,
          height: windowHeight,
          depth: windowDepth,
          position: new THREE.Vector3(-width / 2 - 0.01, windowY, windowZ),
          rotation: new THREE.Vector3(0, Math.PI / 2, 0)
        });
      }

      // Right windows
      for (let i = 0; i < sideWindowsCount; i++) {
        const windowZ = (i - (sideWindowsCount - 1) / 2) * (depth / sideWindowsCount);
        this.createWindow({
          width: windowWidth,
          height: windowHeight,
          depth: windowDepth,
          position: new THREE.Vector3(width / 2 + 0.01, windowY, windowZ),
          rotation: new THREE.Vector3(0, -Math.PI / 2, 0)
        });
      }
    }
  }

  createWindow(params) {
    const geometry = new THREE.PlaneGeometry(params.width, params.height);
    const material = new THREE.MeshBasicMaterial({
      color: this.options.windowColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const window = new THREE.Mesh(geometry, material);

    window.position.copy(params.position);
    window.rotation.setFromVector3(params.rotation);

    window.userData.isBuilding = true;
    window.userData.buildingPart = 'window';

    this.mesh.add(window);
    this.parts.push(window);
    // Windows don't collide
  }

  createDoors() {
    const { width, depth } = this.dimensions;
    const doorWidth = 1.5;
    const doorHeight = 2.2;
    const doorDepth = 0.05;

    // Front door
    this.createDoor({
      width: doorWidth,
      height: doorHeight,
      depth: doorDepth,
      position: new THREE.Vector3(0, doorHeight / 2, depth / 2 + 0.01),
      rotation: new THREE.Vector3(0, 0, 0)
    });

    // Back door
    this.createDoor({
      width: doorWidth,
      height: doorHeight,
      depth: doorDepth,
      position: new THREE.Vector3(0, doorHeight / 2, -depth / 2 - 0.01),
      rotation: new THREE.Vector3(0, Math.PI, 0)
    });
  }

  createDoor(params) {
    const geometry = new THREE.PlaneGeometry(params.width, params.height);
    const material = new THREE.MeshLambertMaterial({
      color: 0x8B4513,
      side: THREE.DoubleSide
    });
    const door = new THREE.Mesh(geometry, material);

    door.position.copy(params.position);
    door.rotation.setFromVector3(params.rotation);

    door.userData.isBuilding = true;
    door.userData.buildingPart = 'door';
    door.userData.isPassable = true; // Mark as passable

    this.mesh.add(door);
    this.parts.push(door);
    // Doors don't get added to colliders
  }

  createInterior() {
    // Define interior space for navigation
    const { width, height, depth } = this.dimensions;
    const wallThickness = 0.2;

    const interiorWidth = width - wallThickness * 2;
    const interiorDepth = depth - wallThickness * 2;

    // Create an invisible box to represent the interior space
    const interiorSpace = new THREE.Box3(
      new THREE.Vector3(-interiorWidth / 2, 0, -interiorDepth / 2),
      new THREE.Vector3(interiorWidth / 2, height, interiorDepth / 2)
    );

    // Transform to world coordinates
    interiorSpace.translate(this.position);

    this.interiorSpaces.push(interiorSpace);
  }

  addToCollisionSystem() {
    // Add all colliders to the global walls array for collision detection
    if (window.walls) {
      window.walls.push(...this.colliders);
    }
  }

  removeFromCollisionSystem() {
    // Remove all colliders from the global walls array
    if (window.walls) {
      this.colliders.forEach(collider => {
        const index = window.walls.indexOf(collider);
        if (index !== -1) {
          window.walls.splice(index, 1);
        }
      });
    }
  }

  destroy() {
    // Remove from scene
    this.scene.remove(this.mesh);

    // Remove from collision system
    this.removeFromCollisionSystem();
  }

  isPointInside(point) {
    // Check if a point is inside any of the building's interior spaces
    return this.interiorSpaces.some(space => space.containsPoint(point));
  }
}

// Simple house building
class House extends Building {
  constructor(scene, position, options = {}) {
    // Default house dimensions
    const dimensions = {
      width: options.width || 10,
      height: options.height || 4,
      depth: options.depth || 8
    };

    // Merge with default options
    const houseOptions = Object.assign({
      color: 0xdddddd,
      windowColor: 0xaaccff,
      roofColor: 0x883322,
      floors: 1
    }, options);

    super(scene, position, dimensions, houseOptions);
  }
}

// Office building
class OfficeBuilding extends Building {
  constructor(scene, position, options = {}) {
    // Default office building dimensions
    const dimensions = {
      width: options.width || 20,
      height: options.height || 15,
      depth: options.depth || 15
    };

    // Merge with default options
    const officeOptions = Object.assign({
      color: 0x999999,
      windowColor: 0x88ccff,
      roofColor: 0x444444,
      floors: 3
    }, options);

    super(scene, position, dimensions, officeOptions);
  }
}

// Export building classes
window.BuildingSystem = {
  Building,
  House,
  OfficeBuilding
}; 