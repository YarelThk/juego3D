import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/GLTFLoader.js';

import { PhysicsWorld } from './PhysicsWorld.js';

export let scene, camera, renderer;
export let physics;
export let worldColliders = [];

// ─────────────────────────────
// AUDIO
// ─────────────────────────────
let listener;
let audioLoader;

let bgSound;
let hitSound;

let audioUnlocked = false;
let bgReady = false;

// ✔ audio seguro (sin exports rotos)
export function playHitSound() {
    if (!hitSound?.buffer) return;
    hitSound.stop();
    hitSound.play();
}

// ─────────────────────────────
// INIT SCENE
// ─────────────────────────────
export function initScene() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 5, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    physics = new PhysicsWorld(scene, () => worldColliders);

    initLights();
    initAudio();
    loadHDR();
    loadMap();
}

// ─────────────────────────────
// LIGHTS
// ─────────────────────────────
function initLights() {

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;

    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
}

// ─────────────────────────────
// HDR
// ─────────────────────────────
function loadHDR() {

    new RGBELoader().load('./assets/textures/sky.hdr', (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = tex;
        scene.environment = tex;
    });
}

// ─────────────────────────────
// AUDIO INIT
// ─────────────────────────────
function initAudio() {

    listener = new THREE.AudioListener();
    camera.add(listener);

    audioLoader = new THREE.AudioLoader();

    bgSound = new THREE.Audio(listener);
    hitSound = new THREE.Audio(listener);

    audioLoader.load('./assets/audio/bg.mp3', (buffer) => {
        bgSound.setBuffer(buffer);
        bgSound.setLoop(true);
        bgSound.setVolume(0.4);
        bgReady = true;

        if (audioUnlocked) bgSound.play();
    });

    audioLoader.load('./assets/audio/hit.mp3', (buffer) => {
        hitSound.setBuffer(buffer);
        hitSound.setVolume(0.8);
    });
}

// ─────────────────────────────
// AUDIO UNLOCK (browser policy)
export function unlockAudio() {

    const ctx = listener?.context;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
            audioUnlocked = true;
            if (bgReady) bgSound.play();
        });
    } else {
        audioUnlocked = true;
        if (bgReady) bgSound.play();
    }
}

// ─────────────────────────────
// MAPA + COLISIONES (FIX ESCALA + LOADER FIX)
// ─────────────────────────────
function loadMap() {

    const loader = new GLTFLoader(); // 🔥 FIX: SIEMPRE AQUÍ

    loader.load('./assets/models/escenario.glb', (gltf) => {

        const map = gltf.scene;

        // ─────────────────────────────
        // 🔥 NORMALIZAR ESCALA DEL MUNDO
        // ─────────────────────────────
        const box = new THREE.Box3().setFromObject(map);
        const size = new THREE.Vector3();
        box.getSize(size);

        const maxSize = Math.max(size.x, size.z);
        const TARGET_SIZE = 80;

        const scale = TARGET_SIZE / maxSize;

        map.scale.setScalar(scale);

        // centrar mundo correctamente
        const center = new THREE.Vector3();
        box.getCenter(center);
        map.position.sub(center.multiplyScalar(scale));

        // ─────────────────────────────
        // COLISIONES
        // ─────────────────────────────
        worldColliders.length = 0;

        map.traverse((o) => {
            if (o.isMesh) {

                o.castShadow = true;
                o.receiveShadow = true;

                worldColliders.push(o);
            }
        });

        scene.add(map);

        console.log('[ENGINE] Map loaded OK | Colliders:', worldColliders.length);
    });
}

// ─────────────────────────────
// CAMERA SYSTEM (NO ERROR IMPORT)
// ─────────────────────────────
export function updateCamera(player, enemy) {

    if (!player?.mesh || !enemy?.mesh) return;

    const mid = new THREE.Vector3()
        .addVectors(player.mesh.position, enemy.mesh.position)
        .multiplyScalar(0.5);

    const dist = player.mesh.position.distanceTo(enemy.mesh.position);

    const dir = new THREE.Vector3()
        .subVectors(player.mesh.position, enemy.mesh.position)
        .normalize();

    const camDist = Math.min(18, Math.max(8, dist * 1.2));
    const height = 3 + dist * 0.25;

    const offset = dir.multiplyScalar(camDist);
    offset.y = height;

    const target = mid.clone().add(offset);

    camera.position.lerp(target, 0.08);
    camera.lookAt(mid);
}

// ─────────────────────────────
export function render() {
    renderer.render(scene, camera);
}