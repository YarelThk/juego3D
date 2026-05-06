import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/FBXLoader.js';
import { scene, physics } from './scene.js';
import { keys } from './controls.js';
import { enemy } from './enemy.js';
import { playHitSound } from './scene.js';

// ─────────────────────────────────────────────────────────────
// CONSTANTES DE PERSONAJE
// Los modelos FBX de Mixamo exportan a ~180 unidades de altura.
// Escalamos a 0.0111 → ~2.0 unidades Three.js (≈ 2 m reales).
// ─────────────────────────────────────────────────────────────
export const CHAR_SCALE   = 0.0111;   // Misma escala para player y enemy
export const CHAR_HEIGHT  = 2.0;      // Altura del personaje en unidades de escena
export const CHAR_RADIUS  = 0.4;      // Radio de cápsula / hitbox
const GROUND_OFFSET       = 0.02;     // Separación mínima con el suelo

export let player = {
    mesh: null,
    speed: 5,
    health: 100,
    energy: 0,

    isBlocking: false,
    isSpecial: false,
    specialTimer: 0,
    attackCooldown: 0,

    currentState: 'idle',

    mixer: null,
    actions: {},
    currentAction: null
};

export function initPlayer() {
    const loader = new FBXLoader();

    loader.load('./assets/models/Standing Idle To Fight Idle.fbx', (object) => {
        player.mesh = object;

        // ── Escala normalizada (igual que enemy) ───────────────
        player.mesh.scale.setScalar(CHAR_SCALE);

        // ── Spawn en suelo (y=0), el ground-fix lo ajusta al piso real
        player.mesh.position.set(-3, 0, 0);

        player.mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(player.mesh);

        // ── Animaciones ────────────────────────────────────────
        player.mixer = new THREE.AnimationMixer(player.mesh);

        const idleAction = player.mixer.clipAction(object.animations[0]);
        player.actions['idle'] = idleAction;
        player.currentAction = idleAction;
        idleAction.play();

        loadAnimation(loader, './assets/models/Walking.fbx', 'walk');
        loadAnimation(loader, './assets/models/Punching.fbx', 'punch', true);
        loadAnimation(loader, './assets/models/Side Kick.fbx', 'kick', true);
        loadAnimation(loader, './assets/models/Center Block.fbx', 'block');
    });
}

function loadAnimation(loader, path, name, isAttack = false) {
    loader.load(path, (animObject) => {
        if (!animObject.animations || animObject.animations.length === 0) return;

        const anim = animObject.animations[0];

        // Fix de prefijos Mixamo
        anim.tracks.forEach(track => {
            track.name = track.name.replace(/.*mixamorig/i, 'mixamorig');
        });

        const action = player.mixer.clipAction(anim);

        if (isAttack) {
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
        }

        player.actions[name] = action;
    });
}

function fadeToAction(name, duration = 0.2) {
    const nextAction = player.actions[name];
    if (!nextAction || player.currentAction === nextAction) return;

    nextAction.reset().fadeIn(duration).play();
    if (player.currentAction) player.currentAction.fadeOut(duration);
    player.currentAction = nextAction;
}

export function updatePlayer(delta) {

    if (!player.mesh) return;
    if (player.mixer) player.mixer.update(delta);

    if (player.attackCooldown > 0) player.attackCooldown -= delta;

    let targetAnimation = 'idle';
    let canAct = player.attackCooldown <= 0;

    if (!canAct && (player.currentState === 'punch' || player.currentState === 'kick')) {
        targetAnimation = player.currentState;
    } else {
        player.currentState = 'idle';
    }

    player.isBlocking = keys['b'];

    if (player.isBlocking) {
        targetAnimation = 'block';
        player.currentState = 'block';
        canAct = false;
    } else if (canAct) {
        if (keys['k']) {
            executeAttack(10, 0.65);
            targetAnimation = 'punch';
            player.currentState = 'punch';
            canAct = false;
        } else if (keys['l']) {
            executeAttack(20, 0.85);
            targetAnimation = 'kick';
            player.currentState = 'kick';
            canAct = false;
        }
    }

    // ── Movimiento ─────────────────────────────────────────────
    const move = new THREE.Vector3();

    if (canAct) {
        if (keys['w']) move.z -= 1;
        if (keys['s']) move.z += 1;
        if (keys['a']) move.x -= 1;
        if (keys['d']) move.x += 1;
    }

    if (move.length() > 0) {
        move.normalize();
        targetAnimation = 'walk';
        player.currentState = 'walk';

        let speed = player.speed;
        if (keys['shift']) speed *= 1.5;

        const next = player.mesh.position.clone().add(
            move.clone().multiplyScalar(speed * delta)
        );

        if (physics && typeof physics.canMove === 'function') {
            if (physics.canMove(player.mesh.position, move, speed * delta)) {
                player.mesh.position.copy(next);
            }
        } else {
            player.mesh.position.copy(next);
        }

        const targetRotation = Math.atan2(move.x, move.z);
        player.mesh.rotation.y += (targetRotation - player.mesh.rotation.y) * 0.15;
    }

    fadeToAction(targetAnimation);

    // ── Ground Fix ────────────────────────────────────────────
    groundSnap(player.mesh);
}

// ─────────────────────────────────────────────────────────────
// GROUND SNAP
// Raycast desde la cintura hacia abajo para pegar el personaje
// al suelo real del escenario.
// ─────────────────────────────────────────────────────────────
// ... (resto del código igual hasta llegar a groundSnap)

export function groundSnap(mesh) {
    if (!physics?.raycaster && typeof physics.getColliders !== 'function') return;

    // Lanzamos el rayo desde un poco arriba del personaje para asegurar que detecte el suelo
    const origin = mesh.position.clone();
    origin.y += 2; // Elevamos el origen del rayo temporalmente para el cálculo

    physics.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
    physics.raycaster.far = 5; // Rango de búsqueda

    const hits = physics.raycaster.intersectObjects(physics.getColliders(), true);

    if (hits.length > 0) {
        player.mesh.position.y = hits[0].point.y + 0.5; 
    }
}

// ─────────────────────────────────────────────────────────────
// HITBOX AABB del jugador (coordenadas de escena)
// ─────────────────────────────────────────────────────────────
export function getPlayerAABB() {
    if (!player.mesh) return null;
    const pos = player.mesh.position;
    return new THREE.Box3(
        new THREE.Vector3(pos.x - CHAR_RADIUS, pos.y,               pos.z - CHAR_RADIUS),
        new THREE.Vector3(pos.x + CHAR_RADIUS, pos.y + CHAR_HEIGHT, pos.z + CHAR_RADIUS)
    );
}

function executeAttack(damageValue, cooldownTime) {
    player.attackCooldown = cooldownTime;
    playHitSound();

    if (enemy && enemy.mesh) {
        // Alcance = radio jugador + radio enemigo + margen de golpe
        const attackReach = CHAR_RADIUS * 2 + 0.5;
        const dist = player.mesh.position.distanceTo(enemy.mesh.position);

        if (dist < attackReach) {
            if (enemy.isBlocking) {
                player.energy += 3;
            } else {
                enemy.health -= damageValue;
                player.energy += 8;
            }
        }
    }
}
