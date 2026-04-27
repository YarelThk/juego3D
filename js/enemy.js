import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { scene } from './scene.js';
import { player } from './player.js';

export let enemy = {
    mesh: null,
    speed: 3,
    health: 100,
    isBlocking: false,
    decisionTimer: 0,
    attackCooldown: 0
};

export function initEnemy() {
    const geo = new THREE.BoxGeometry(1,2,1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    enemy.mesh = new THREE.Mesh(geo, mat);

    enemy.mesh.position.set(5,1,0);
    scene.add(enemy.mesh);
}

export function updateEnemy(delta) {
    if (!enemy.mesh || !player.mesh) return;

    let distance = enemy.mesh.position.distanceTo(player.mesh.position);

    if (enemy.attackCooldown > 0) enemy.attackCooldown -= delta;

    enemy.decisionTimer -= delta;

    if (enemy.decisionTimer <= 0) {
        enemy.decisionTimer = 1;

        if (distance < 2) {
            if (Math.random() < 0.3) {
                enemy.isBlocking = true;
                setTimeout(() => enemy.isBlocking = false, 600);
            } else if (enemy.attackCooldown <= 0) {
                attackPlayer();
                enemy.attackCooldown = 1;
            }
        }
    }

    if (distance > 2) {
        let dir = player.mesh.position.clone().sub(enemy.mesh.position).normalize();
        enemy.mesh.position.add(dir.multiplyScalar(enemy.speed * delta));
    }

    enemy.mesh.lookAt(player.mesh.position);

    // límites
    const limit = 20;
    enemy.mesh.position.x = Math.max(-limit, Math.min(limit, enemy.mesh.position.x));
    enemy.mesh.position.z = Math.max(-limit, Math.min(limit, enemy.mesh.position.z));

    // visual
    if (enemy.isBlocking) {
        enemy.mesh.material.color.set(0x0000ff);
    } else {
        enemy.mesh.material.color.set(0xff0000);
    }
}

function attackPlayer() {
    if (!player.mesh) return;

    if (player.isBlocking) {
        player.health -= 1;
        player.energy += 3;
    } else {
        player.health -= 5;
        player.energy += 5;
    }
}