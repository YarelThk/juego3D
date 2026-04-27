import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { scene } from './scene.js';
import { keys } from './controls.js';
import { enemy } from './enemy.js';

export let player = {
    mesh: null,
    speed: 5,
    health: 100,
    energy: 0,

    isAttacking: false,
    attackCooldown: 0,
    isBlocking: false,

    // especial
    isSpecial: false,
    specialTimer: 0,

    // combo
    comboStep: 0,
    comboTimer: 0
};

export function initPlayer() {
    const geo = new THREE.BoxGeometry(1,2,1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player.mesh = new THREE.Mesh(geo, mat);

    player.mesh.position.y = 1;
    scene.add(player.mesh);
}

export function updatePlayer(delta) {
    if (!player.mesh) return;

    // 🛡️ bloqueo
    player.isBlocking = keys['b'];

    // ⚡ activar especial
    if (keys['e'] && player.energy >= 100 && !player.isSpecial) {
        player.isSpecial = true;
        player.specialTimer = 5;
        player.energy = 0;
    }

    // ⏳ especial
    if (player.isSpecial) {
        player.specialTimer -= delta;
        if (player.specialTimer <= 0) player.isSpecial = false;
    }

    // 🎮 movimiento + sprint
    let move = new THREE.Vector3();

    if (keys['w']) move.z -= 1;
    if (keys['s']) move.z += 1;
    if (keys['a']) move.x -= 1;
    if (keys['d']) move.x += 1;

    move.normalize();

    let speed = player.speed;

    if (keys['shift']) speed *= 1.8;
    if (player.isSpecial) speed *= 1.5;

    player.mesh.position.add(move.multiplyScalar(speed * delta));

    // ⏳ cooldown
    if (player.attackCooldown > 0) player.attackCooldown -= delta;

    // 🥊 COMBO (K)
    if (keys['k'] && player.attackCooldown <= 0 && !player.isBlocking) {
        comboAttack();
    }

    // 🦵 PATADA (L)
    if (keys['l'] && player.attackCooldown <= 0 && !player.isBlocking) {
        attack(true);
        player.comboStep = 0;
    }

    // ⏳ combo reset
    if (player.comboTimer > 0) {
        player.comboTimer -= delta;
    } else {
        player.comboStep = 0;
    }

    // límites
    const limit = 20;
    player.mesh.position.x = Math.max(-limit, Math.min(limit, player.mesh.position.x));
    player.mesh.position.z = Math.max(-limit, Math.min(limit, player.mesh.position.z));

    // 🎨 visual
    if (player.isSpecial) {
        player.mesh.material.color.set(0x00ffff);
    } else if (player.isBlocking) {
        player.mesh.material.color.set(0x0000ff);
    } else {
        player.mesh.material.color.set(0x00ff00);
    }
}

function comboAttack() {
    player.comboStep++;

    if (player.comboStep > 3) player.comboStep = 1;

    player.comboTimer = 0.8;

    attack(false, player.comboStep);
}

function attack(isKick = false, combo = 1) {
    if (!enemy.mesh) return;

    player.attackCooldown = 0.3;

    // daño base
    let damage = isKick ? 12 : 8;

    // combo escala daño
    damage += combo * 2;

    // especial boost
    if (player.isSpecial) damage *= 1.5;

    // hitbox tamaño
    const size = player.isSpecial ? 1.5 : 1;

    const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
    );

    hitbox.position.copy(player.mesh.position);
    hitbox.position.z -= 1;

    scene.add(hitbox);

    let playerBox = new THREE.Box3().setFromObject(hitbox);
    let enemyBox = new THREE.Box3().setFromObject(enemy.mesh);

    if (playerBox.intersectsBox(enemyBox)) {
        if (!enemy.isBlocking) {
            enemy.health -= damage;
            player.energy += 10;
        } else {
            player.energy += 4;
        }
    }

    setTimeout(() => scene.remove(hitbox), 100);
}