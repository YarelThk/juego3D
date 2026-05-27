import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/FBXLoader.js';
import { scene, physics } from './scene.js';
import { playHitSound } from './scene.js';
import { CHAR_SCALE, CHAR_HEIGHT, CHAR_RADIUS, groundSnap } from './player.js';

export let enemy = {
    mesh: null,
    speed: 3.5,
    health: 100,
    isBlocking: false,
    attackCooldown: 0,
    currentState: 'idle',
    mixer: null,
    actions: {},
    currentAction: null
};

export function initEnemy(manager = null) {
    const loader = new FBXLoader(manager);
    loader.load('./assets/models/Enemy_Standing Idle To Fight Idle.fbx', (object) => {
        enemy.mesh = object;
        
        const box = new THREE.Box3().setFromObject(enemy.mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        const targetHeight = 6.6;
        const scale = targetHeight / size.y;
        
        enemy.mesh.scale.setScalar(scale);
        enemy.mesh.position.set(0, 20, -3);
        
        enemy.mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        enemy.mixer = new THREE.AnimationMixer(enemy.mesh);
        
        if (object.animations && object.animations.length > 0) {
            const idleAction = enemy.mixer.clipAction(object.animations[0]);
            enemy.actions['idle'] = idleAction;
            enemy.currentAction = idleAction;
            idleAction.play();
        }
        
        scene.add(enemy.mesh);
        
        loadAnimation(loader, './assets/models/Enemy_Walking.fbx', 'walk');
        loadAnimation(loader, './assets/models/Enemy_Punching.fbx', 'punch', true);
        loadAnimation(loader, './assets/models/Enemy_Side Kick.fbx', 'kick', true);
        loadAnimation(loader, './assets/models/Enemy_Center Block.fbx', 'block');
    });
}

function loadAnimation(loader, path, name, isAttack = false) {
    console.log(`[CARGA INICIADA] ${path}`);
    loader.load(
        path,
        (animObject) => {
            if (!animObject.animations || animObject.animations.length === 0) {
                console.error(`[ERROR FBX] '${path}' sin animaciones.`);
                return;
            }
            const anim = animObject.animations[0];
            console.log(`[OK] '${name}' | duración: ${anim.duration.toFixed(2)}s`);
            
            anim.tracks.forEach(track => {
                track.name = track.name.replace(/.*mixamorig/i, 'mixamorig');
            });
            
            const action = enemy.mixer.clipAction(anim);
            if (isAttack) {
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            }
            enemy.actions[name] = action;
        },
        undefined,
        (error) => {
            console.error(`[ERROR RED] No se pudo cargar '${path}'`, error);
        }
    );
}

function fadeToAction(name, duration = 0.2) {
    const nextAction = enemy.actions[name];
    if (!nextAction || enemy.currentAction === nextAction) return;
    
    nextAction.reset().fadeIn(duration).play();
    if (enemy.currentAction) enemy.currentAction.fadeOut(duration);
    enemy.currentAction = nextAction;
}

export function updateEnemy(delta, playerRef, isPlaying = true) {
    if (!enemy.mesh) return;
    
    if (enemy.mixer) enemy.mixer.update(delta);
    
    if (!isPlaying) {
        fadeToAction('idle');
        groundSnap(enemy.mesh);
        return;
    }
    
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= delta;
    
    let targetAnimation = 'idle';
    let canAct = enemy.attackCooldown <= 0;
    
    if (!canAct && (enemy.currentState === 'punch' || enemy.currentState === 'kick' || enemy.currentState === 'block')) {
        targetAnimation = enemy.currentState;
    } else {
        enemy.currentState = 'idle';
        enemy.isBlocking = false;
    }

    if (playerRef && playerRef.mesh && canAct && enemy.health > 0) {
        const dist = enemy.mesh.position.distanceTo(playerRef.mesh.position);
        const dir = new THREE.Vector3().subVectors(playerRef.mesh.position, enemy.mesh.position);
        dir.y = 0;
        if (dir.length() > 0) dir.normalize();
        
        const targetRotation = Math.atan2(dir.x, dir.z);
        enemy.mesh.rotation.y += (targetRotation - enemy.mesh.rotation.y) * 0.10;
        
        const attackReach = CHAR_RADIUS * 2 + 0.5;
        
        if (dist > attackReach) {
            targetAnimation = 'walk';
            enemy.currentState = 'walk';
            
            const next = enemy.mesh.position.clone().add(dir.clone().multiplyScalar(enemy.speed * delta));
            if (physics && typeof physics.canMove === 'function') {
                if (physics.canMove(enemy.mesh.position, dir, enemy.speed * delta)) {
                    enemy.mesh.position.copy(next);
                }
            }
        } else {
            const actionChoice = Math.random();
            if (actionChoice < 0.4) {
                targetAnimation = 'block';
                enemy.currentState = 'block';
                enemy.attackCooldown = 0.8;
                enemy.isBlocking = Math.random() > 0.5;
                canAct = false;
            } else {
                const isKick = Math.random() > 0.5;
                targetAnimation = isKick ? 'kick' : 'punch';
                enemy.currentState = targetAnimation;
                executeAttack(isKick ? 15 : 10, isKick ? 0.85 : 0.65, playerRef);
                canAct = false;
            }
        }
    }
    
    fadeToAction(targetAnimation);
    groundSnap(enemy.mesh);
}

export function getEnemyAABB() {
    if (!enemy.mesh) return null;
    const pos = enemy.mesh.position;
    return new THREE.Box3(
        new THREE.Vector3(pos.x - CHAR_RADIUS, pos.y, pos.z - CHAR_RADIUS),
        new THREE.Vector3(pos.x + CHAR_RADIUS, pos.y + CHAR_HEIGHT, pos.z + CHAR_RADIUS)
    );
}

function executeAttack(damageValue, cooldownTime, playerRef) {
    enemy.attackCooldown = cooldownTime;
    playHitSound();
    
    if (playerRef && playerRef.health !== undefined) {
        if (playerRef.isBlocking) {
            console.log('[COMBAT] Ataque enemigo bloqueado.');
        } else {
            playerRef.health -= damageValue;
            console.log(`[COMBAT] Daño: ${damageValue} | HP jugador: ${playerRef.health}`);
        }
    }
}