// 3D care-home scene: loads web/models/carehome.glb if present, otherwise builds a
// procedural placeholder of the 10 named rooms (A1..D2). Exposes highlightGroup() to
// light up the room(s) the model chose, and reset() to clear.
//
// SketchUp GLB conventions handled:
//   - Room names live on parent GROUP nodes (not meshes): "ROOM A1", "ROOMS B1", etc.
//   - "ROOMS B" (with no number) is mapped to B3.
//   - Child meshes (named "Geom3D") are collected under each room group for highlighting.
//   - SketchUp exports in centimetres; we scale to metres (×0.01).
//   - UUID-named nodes are ignored to avoid false-positive matching.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GROUP_ROOMS, GROUP_META } from "./assign.js";

const MODEL_URL = "./models/carehome.glb";
const CM_TO_M = 1.0; // Model is already scaled to meters by exporter

// Placeholder layout (metres) around a central courtyard. group + position per room.
const PLACEHOLDER_ROOMS = [
  // South row — sun (A, 4 singles)
  { id: "A1", group: "A", x: -6, z: 6.5, w: 3.2, d: 3.2 },
  { id: "A2", group: "A", x: -2, z: 6.5, w: 3.2, d: 3.2 },
  { id: "A3", group: "A", x: 2, z: 6.5, w: 3.2, d: 3.2 },
  { id: "A4", group: "A", x: 6, z: 6.5, w: 3.2, d: 3.2 },
  // West column — afternoon sun (B, 3 doubles)
  { id: "B1", group: "B", x: -7.5, z: -3.5, w: 3.6, d: 4.2 },
  { id: "B2", group: "B", x: -7.5, z: 0.5, w: 3.6, d: 4.2 },
  { id: "B3", group: "B", x: -7.5, z: 4.5, w: 3.6, d: 4.2 },
  // North row — calm (C, 1 double) + courtyard singles (D, 2)
  { id: "C1", group: "C", x: -5, z: -6.5, w: 4.2, d: 3.2 },
  { id: "D1", group: "D", x: 0.5, z: -6.5, w: 3.2, d: 3.2 },
  { id: "D2", group: "D", x: 4.5, z: -6.5, w: 3.2, d: 3.2 },
];

const tint = (hex, f) => new THREE.Color(hex).lerp(new THREE.Color("#e9eef2"), f);

// Map a SketchUp node name to one of our room IDs.
// Handles: "ROOM A1" → A1, "ROOMS B1" → B1, "ROOMS B" → B3, exact "A1" → A1.
// Returns null if not a room name (skips UUIDs and generic names).
function matchRoomName(nodeName, allIds) {
  if (!nodeName) return null;
  const upper = nodeName.toUpperCase().trim();
  // Skip UUID-style names (contain dashes with hex sequences)
  if (/^[0-9a-f]{8}-/.test(nodeName)) return null;
  // Direct exact match
  if (allIds.includes(upper)) return upper;
  // "ROOM A1" or "ROOMS B1" (also handles underscores "ROOM_A1" / "ROOMS_B1") → strip prefix
  const m = upper.match(/^ROOMS?[\s_]+(.+)$/);
  if (m) {
    const suffix = m[1];
    if (allIds.includes(suffix)) return suffix;
    // Special case: "ROOMS B" (no number) → B3 (the only B room without its own node)
    if (suffix === "B") return "B3";
  }
  return null;
}

export class CareHome {
  constructor(canvas) {
    this.canvas = canvas;
    // roomId -> { meshes: [mesh, ...], mats: [{mat, baseEmissive, baseIntensity}, ...] }
    this.rooms = {};
    this.highlighted = [];
    this.clock = new THREE.Clock();
    this._usingRealModel = false;
    this._initRenderer();
    this._initScene();
    this._load();
    window.addEventListener("resize", () => this._resize());
    this._animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(18, 16, 22);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45; // Slower, more deliberate rotation
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 80;
    this.controls.target.set(0, 1.5, 0);

    // Soft architectural ambient illumination
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 0.95));
    
    // Warm sun light for realistic shadows
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25;
    this.scene.add(sun);

    // Subtle dark coordinate grid helper for professional architectural styling
    const grid = new THREE.GridHelper(60, 60, 0xff5a1f, 0xe5e5e5);
    grid.position.y = 0.005;
    this.scene.add(grid);

    // Transparent shadow receiver plane
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.ShadowMaterial({ opacity: 0.15 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // courtyard patch (only visible for placeholder layout)
    this.yard = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 1 })
    );
    this.yard.rotation.x = -Math.PI / 2;
    this.yard.position.y = 0.01;
    this.scene.add(this.yard);
  }

  // Register a room with one or more meshes (real model rooms have child meshes)
  _registerRoom(id, group, meshes) {
    const meshArray = Array.isArray(meshes) ? meshes : [meshes];
    const allMats = [];
    for (const mesh of meshArray) {
      const rawMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of rawMats) {
        const mat = m.clone();
        if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
        allMats.push({ mat, baseEmissive: mat.emissive.getHex(), baseIntensity: mat.emissiveIntensity ?? 1 });
      }
      mesh.material = rawMats.length === 1 ? allMats[allMats.length - 1].mat
                                            : allMats.slice(-rawMats.length).map((x) => x.mat);
      mesh.userData.group = group;
      mesh.userData.roomId = id;
    }
    this.rooms[id] = { meshes: meshArray, mats: allMats };
  }

  _buildPlaceholder() {
    const group = new THREE.Group();
    const groupColors = { A: "#111111", B: "#555555", C: "#888888", D: "#dddddd" };
    for (const r of PLACEHOLDER_ROOMS) {
      const base = new THREE.Color(groupColors[r.group]);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(r.w, 3, r.d),
        new THREE.MeshStandardMaterial({ color: base, roughness: 0.85, metalness: 0.0 })
      );
      mesh.position.set(r.x, 1.5, r.z);
      mesh.name = r.id;
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      this._registerRoom(r.id, r.group, mesh);

      const label = this._makeLabel(r.id);
      label.position.set(r.x, 3.4, r.z);
      group.add(label);
    }
    this.scene.add(group);
    this.modelRoot = group;
  }

  _makeLabel(text) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(20,28,34,0.0)"; ctx.fillRect(0, 0, 128, 64);
    ctx.font = "bold 40px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#111111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(2.6, 1.3, 1);
    return spr;
  }

  // Collect all descendant meshes from a node (for room groups that contain child geometries)
  _collectMeshes(node) {
    const meshes = [];
    node.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    return meshes;
  }

  _load() {
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const root = gltf.scene;
        const allIds = Object.values(GROUP_ROOMS).flat();
        const groupOf = {};
        for (const [g, ids] of Object.entries(GROUP_ROOMS)) ids.forEach((id) => (groupOf[id] = g));

        // Pass 1: find room-named group nodes and collect their child meshes
        let found = 0;
        const roomNodes = new Set();   // track nodes claimed by rooms (don't shadow-cast duplicate)
        root.traverse((o) => {
          // Hide DWG floor plane to prevent massive z-fighting on the floor
          if (o.isMesh && o.name && o.name.includes("New Model") && o.name.includes(".dwg")) {
            o.visible = false;
          }
          
          const id = matchRoomName(o.name, allIds);
          if (id && !this.rooms[id]) {
            const childMeshes = this._collectMeshes(o);
            if (childMeshes.length > 0) {
              this._registerRoom(id, groupOf[id], childMeshes);
              childMeshes.forEach((m) => roomNodes.add(m));
              found++;
              console.log(`  Room ${id}: mapped from "${o.name}" (${childMeshes.length} mesh${childMeshes.length > 1 ? "es" : ""})`);
            }
          }
        });

        // Pass 2: enable shadows on all meshes
        root.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });

        // Scale the model from cm to metres
        root.scale.setScalar(CM_TO_M);

        // Frame the model: centre it on XZ, sit it on the ground plane
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        root.position.x -= centre.x;
        root.position.z -= centre.z;
        root.position.y -= box.min.y;  // sit on y=0

        this.scene.add(root);
        this.modelRoot = root;

        if (found === 0) {
          console.warn("carehome.glb loaded but no rooms named A1..D2 were found — using placeholder.");
          this.scene.remove(root);
          this._buildPlaceholder();
        } else {
          this._usingRealModel = true;
          // Adjust ground plane to fit the real model
          const maxDim = Math.max(size.x, size.z) * 0.8;
          this.ground.geometry.dispose();
          this.ground.geometry = new THREE.CircleGeometry(maxDim, 64);
          this.yard.visible = false; // courtyard patch is for placeholder only

          // Adjust shadow camera to cover the real model
          const sun = this.scene.children.find((c) => c.isDirectionalLight);
          if (sun) {
            const halfSize = maxDim * 0.7;
            sun.shadow.camera.left = -halfSize;
            sun.shadow.camera.right = halfSize;
            sun.shadow.camera.top = halfSize;
            sun.shadow.camera.bottom = -halfSize;
            sun.shadow.camera.updateProjectionMatrix();
          }

          // Adjust camera for the real model's scale
          const camDist = Math.max(size.x, size.y, size.z) * 1.4;
          this.camera.position.set(camDist * 0.75, camDist * 0.55, camDist * 0.85);
          this.camera.near = 0.05;
          this.camera.far = camDist * 5;
          this.camera.updateProjectionMatrix();
          this.controls.target.set(0, size.y * 0.25, 0);
          this.controls.minDistance = camDist * 0.3;
          this.controls.maxDistance = camDist * 3;
          this.controls.update();

          console.log(`carehome.glb: matched ${found}/10 named rooms. Model size: ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} m`);
          const missing = allIds.filter((id) => !this.rooms[id]);
          if (missing.length) console.warn("Missing rooms:", missing.join(", "));
        }
        const overlay = document.getElementById("loading-overlay");
        if (overlay) overlay.classList.add("fade-out");
      },
      (progress) => {
        if (progress.total) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          const textEl = document.getElementById("loading-text");
          if (textEl) textEl.textContent = `Loading 3D Model... ${pct}%`;
        }
      },
      (error) => {
        console.error("Error loading carehome.glb:", error);
        console.log("Showing placeholder model.");
        this._buildPlaceholder();
        const overlay = document.getElementById("loading-overlay");
        if (overlay) overlay.classList.add("fade-out");
      }
    );
  }

  highlightGroup(roomIds) {
    this.reset();
    this.highlighted = roomIds.filter((id) => this.rooms[id]);
    const dimEverythingElse = new Set(this.highlighted);
    for (const [id, r] of Object.entries(this.rooms)) {
      const on = dimEverythingElse.has(id);
      r.mats.forEach(({ mat }) => {
        mat.transparent = !on;
        mat.opacity = on ? 1 : 0.28;
      });
    }
    // ease the camera target to the centroid of the chosen rooms
    if (this.highlighted.length) {
      const center = new THREE.Vector3();
      for (const id of this.highlighted) {
        const r = this.rooms[id];
        // Compute world centre of all meshes in this room
        for (const mesh of r.meshes) {
          const meshBox = new THREE.Box3().setFromObject(mesh);
          center.add(meshBox.getCenter(new THREE.Vector3()));
        }
      }
      const totalMeshes = this.highlighted.reduce((sum, id) => sum + this.rooms[id].meshes.length, 0);
      center.divideScalar(totalMeshes);
      this._targetTo = center.clone();
      this._targetTo.y = Math.max(this._targetTo.y, 0.5);
      this.controls.autoRotateSpeed = 0.35;
    }
  }

  reset() {
    for (const r of Object.values(this.rooms)) {
      r.mats.forEach(({ mat, baseEmissive, baseIntensity }) => {
        mat.emissive.setHex(baseEmissive);
        mat.emissiveIntensity = baseIntensity;
        mat.transparent = false; mat.opacity = 1;
      });
    }
    this.highlighted = [];
    this._targetTo = null;
    this.controls.autoRotateSpeed = 0.9;
  }

  _resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this._resize();
    const t = this.clock.getElapsedTime();
    // pulse the highlighted rooms
    if (this.highlighted.length) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 3.0);
      for (const id of this.highlighted) {
        const r = this.rooms[id];
        const group = r.meshes[0]?.userData.group;
        if (!group) continue;
        const color = new THREE.Color(GROUP_META[group].color);
        r.mats.forEach(({ mat }) => {
          mat.emissive.copy(color);
          mat.emissiveIntensity = pulse * 1.4;
        });
      }
    }
    if (this._targetTo) this.controls.target.lerp(this._targetTo, 0.05);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
