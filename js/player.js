import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { scene, physics } from './scene.js';
import { keys } from './controls.js';
import { enemy } from './enemy.js';
import { playHitSound } from './scene.js';

export let player = {
    mesh: null,
    speed: 5,
    health: 100,
    energy: 0,

    isBlocking: false,
    isSpecial: false,
    specialTimer: 0,

    attackCooldown: 0
};

export function initPlayer() {

    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

    player.mesh = new THREE.Mesh(geo, mat);
    player.mesh.position.set(0, 5, 0);

    scene.add(player.mesh);
}

export function updatePlayer(delta) {

    if (!player.mesh || !physics) return;

    player.isBlocking = keys['b'];

    // ─────────────────────────────
    // SPECIAL RESTORED
    // ─────────────────────────────
    if (keys['e'] && player.energy >= 100 && !player.isSpecial) {
        player.isSpecial = true;
        player.specialTimer = 5;
        player.energy = 0;
    }

    if (player.isSpecial) {
        player.specialTimer -= delta;
        if (player.specialTimer <= 0) player.isSpecial = false;
    }

    // ─────────────────────────────
    // MOVEMENT
    // ─────────────────────────────
    const move = new THREE.Vector3();

    if (keys['w']) move.z -= 1;
    if (keys['s']) move.z += 1;
    if (keys['a']) move.x -= 1;
    if (keys['d']) move.x += 1;

    if (move.length() > 0) move.normalize();

    let speed = player.speed;

    if (keys['shift']) speed *= 1.5;
    if (player.isSpecial) speed *= 1.3;

    const next = player.mesh.position.clone().add(
        move.clone().multiplyScalar(speed * delta)
    );

    if (physics.canMove(player.mesh.position, move, speed * delta)) {
        player.mesh.position.copy(next);
    }

    // ─────────────────────────────
    // GROUND FIX
    // ─────────────────────────────
    const origin = player.mesh.position.clone();
    origin.y += 2;

    physics.raycaster.set(origin, new THREE.Vector3(0, -1, 0));

    const hit = physics.raycaster.intersectObjects(physics.getColliders(), true);

    if (hit.length) {
        player.mesh.position.y = hit[0].point.y + 1;
    }

    // ─────────────────────────────
    // ATTACK
    // ─────────────────────────────
    if (player.attackCooldown > 0) player.attackCooldown -= delta;

    if (keys['k'] && player.attackCooldown <= 0 && !player.isBlocking) {
        attack();
    }

    player.mesh.material.color.set(
        player.isSpecial ? 0x00ffff :
        player.isBlocking ? 0x0000ff :
        0x00ff00
    );
}

function attack() {

    player.attackCooldown = 0.35;

    playHitSound();

    const dist = player.mesh.position.distanceTo(enemy.mesh.position);

    if (dist < 2.2) {

        if (enemy.isBlocking) {
            player.energy += 3;
        } else {
            enemy.health -= player.isSpecial ? 20 : 10;
            player.energy += 8;
        }
    }
}