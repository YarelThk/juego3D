import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/GLTFLoader.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { vrInput } from './controls.js'; // Importación requerida para leer la rotación del stick derecho

export let scene, camera, renderer;
export let cameraRig; 
export let physics;
export let worldColliders = [];

// AUDIO
let listener;
let audioLoader;
let bgSound;
let hitSound;
let audioUnlocked = false;
let bgReady = false;

export function playHitSound() {
    if (!hitSound?.buffer) return;
    if (hitSound.isPlaying) hitSound.stop();
    hitSound.play();
}

// PANEL VR (UI 3D en mundo)
let vrPanel = null;
let vrCanvas = null;
let vrTexture = null;

export function initVRPanel() {
    vrCanvas = document.createElement('canvas');
    vrCanvas.width = 512;
    vrCanvas.height = 128;
    vrTexture = new THREE.CanvasTexture(vrCanvas);
    
    const geo = new THREE.PlaneGeometry(1.8, 0.45);
    const mat = new THREE.MeshBasicMaterial({
        map: vrTexture,
        transparent: true,
        depthWrite: false
    });
    
    vrPanel = new THREE.Mesh(geo, mat);
    vrPanel.position.set(0, 1.6, -1.5);
    scene.add(vrPanel);
}

export function updateVRPanel(playerHealth, playerEnergy, enemyHealth) {
    if (!vrCanvas || !vrTexture) return;

    const ctx = vrCanvas.getContext('2d');
    ctx.clearRect(0, 0, vrCanvas.width, vrCanvas.height);
    
    // Fondo semitransparente
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 0, 0, vrCanvas.width, vrCanvas.height, 14);
    ctx.fill();
    
    const barH = 18;
    const barW = 190;
    const startY = 18;
    
    // JUGADOR
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('JUGADOR', 16, startY);
    
    drawBar(ctx, 16, startY + 6, barW, barH, Math.max(0, playerHealth) / 100, '#e74c3c', '#333');
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.fillText(`HP: ${Math.max(0, Math.round(playerHealth))}`, 22, startY + 20);
    
    drawBar(ctx, 16, startY + 30, barW, barH, Math.min(playerEnergy, 100) / 100, '#f1c40f', '#333');
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`EN: ${Math.min(100, Math.round(playerEnergy))}`, 22, startY + 44);
    
    // ENEMIGO
    const ex = vrCanvas.width - barW - 16;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('ENEMIGO', ex, startY);
    
    drawBar(ctx, ex, startY + 6, barW, barH, Math.max(0, enemyHealth) / 100, '#e74c3c', '#333');
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.fillText(`HP: ${Math.max(0, Math.round(enemyHealth))}`, ex + 6, startY + 20);
    
    // Controles hint
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('X:Puño Y:Patada B:Bloquear A:Estado JoyL:Mover', vrCanvas.width / 2, vrCanvas.height - 10);
    ctx.textAlign = 'left';
    
    vrTexture.needsUpdate = true;
}

function drawBar(ctx, x, y, w, h, pct, colorFill, colorBg) {
    ctx.fillStyle = colorBg;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    
    ctx.fillStyle = colorFill;
    roundRect(ctx, x, y, Math.max(0, w * pct), h, 5);
    ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// INIT SCENE
export function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    cameraRig = new THREE.Group();
    cameraRig.add(camera);
    scene.add(cameraRig);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
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
    initVRPanel();
}

function initLights() {
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
}

function loadHDR() {
    new RGBELoader().load('./assets/textures/sky.hdr', (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = tex;
        scene.environment = tex;
    });
}

// AUDIO INIT
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

function loadMap() {
    const loader = new GLTFLoader();
    loader.load('./assets/models/escenario.glb', (gltf) => {
        const map = gltf.scene;
        const box = new THREE.Box3().setFromObject(map);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        const maxSize = Math.max(size.x, size.z);
        const TARGET_SIZE = 80;
        const scale = TARGET_SIZE / maxSize;
        
        map.scale.setScalar(scale);
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        map.position.sub(center.multiplyScalar(scale));
        
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

export function updateCamera(player, enemy) {
    if (!player?.mesh) return;
    
    const headHeight = 5.5; // Altura coordinada de los ojos del personaje

    if (renderer.xr.isPresenting) {
        // Rotación de cámara con el stick derecho (ajuste de sensibilidad a 0.035 por frame)
        if (vrInput.rotateX !== 0) {
            cameraRig.rotation.y -= vrInput.rotateX * 0.035;
        }

        // Posiciona el rig en las coordenadas del jugador y lo eleva a la altura de la cabeza
        cameraRig.position.copy(player.mesh.position);
        cameraRig.position.y += headHeight;
        
        // Mantiene la UI flotando de forma coherente frente al jugador
        if (vrPanel) {
            const headPos = player.mesh.position.clone();
            headPos.y += headHeight; 
            vrPanel.position.copy(headPos).add(new THREE.Vector3(0, 0.8, 0));
            if (enemy?.mesh) {
                vrPanel.lookAt(enemy.mesh.position);
            }
        }
        return;
    }

    // MODO DESKTOP
    if (!enemy?.mesh) return;
    
    const dir = new THREE.Vector3().subVectors(enemy.mesh.position, player.mesh.position);
    dir.y = 0;
    if (dir.length() > 0) dir.normalize();
    
    const cameraPos = player.mesh.position.clone()
        .add(new THREE.Vector3(0, headHeight, 0))
        .add(dir.clone().multiplyScalar(0.35));
        
    const targetLookAt = enemy.mesh.position.clone()
        .add(new THREE.Vector3(0, headHeight - 0.5, 0));
        
    cameraRig.position.set(0, 0, 0); 
    camera.position.lerp(cameraPos, 0.2);
    camera.lookAt(targetLookAt);
}

export function render() {
    renderer.render(scene, camera);
}