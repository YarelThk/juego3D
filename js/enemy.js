import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { scene, physics } from './scene.js';
import { player } from './player.js';
import { playHitSound } from './scene.js';

export let enemy = {
    mesh: null,
    speed: 2.5,
    health: 100,

    isBlocking: false,
    decisionTimer: 0,
    attackCooldown: 0
};

// ─────────────────────────────
export function initEnemy() {

    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    enemy.mesh = new THREE.Mesh(geo, mat);
    enemy.mesh.position.set(5, 5, 0);

    enemy.mesh.castShadow = true;

    scene.add(enemy.mesh);
}

// ─────────────────────────────
export function updateEnemy(delta) {

    if (!enemy.mesh || !player.mesh || !physics) return;

    const dist = enemy.mesh.position.distanceTo(player.mesh.position);

    if (enemy.attackCooldown > 0) enemy.attackCooldown -= delta;

    enemy.decisionTimer -= delta;

    if (enemy.decisionTimer <= 0) {

        enemy.decisionTimer = 0.8;

        if (dist < 2.2 && enemy.attackCooldown <= 0) {
            attack();
            enemy.attackCooldown = 1.2;
        }
    }

    // ─────────────────────────────
    // MOVIMIENTO CON COLISIÓN REAL
    // ─────────────────────────────
    if (dist > 2.2) {

        const dir = player.mesh.position.clone()
            .sub(enemy.mesh.position)
            .normalize();

        const nextPos = enemy.mesh.position.clone().add(
            dir.clone().multiplyScalar(enemy.speed * delta)
        );

        if (physics.canMove(enemy.mesh.position, dir, enemy.speed * delta)) {
            enemy.mesh.position.copy(nextPos);
        }
    }

    // ─────────────────────────────
    // SUELO REAL
    // ─────────────────────────────
    const origin = enemy.mesh.position.clone();
    origin.y += 2;

    physics.raycaster.set(origin, new THREE.Vector3(0, -1, 0));

    const hit = physics.raycaster.intersectObjects(
        physics.getColliders(),
        true
    );

    if (hit.length) {
        enemy.mesh.position.y = hit[0].point.y + 1;
    }

    enemy.mesh.lookAt(player.mesh.position);

    enemy.mesh.material.color.set(
        enemy.isBlocking ? 0x0000ff : 0xff0000
    );
}

// ─────────────────────────────
function attack() {

    playHitSound();

    if (player.isBlocking) {
        player.health -= 1;
    } else {
        player.health -= 5;
    }
}