import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/FBXLoader.js';
import { scene, physics, playHitSound } from './scene.js';
import { vrInput } from './controls.js'; 
import { enemy } from './enemy.js';

export let CHAR_SCALE = 0.1; 
export const CHAR_HEIGHT = 6.6; 
export const CHAR_RADIUS = 0.4;

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

        const box = new THREE.Box3().setFromObject(player.mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        const targetHeight = CHAR_HEIGHT;
        CHAR_SCALE = targetHeight / size.y;
        
        player.mesh.scale.setScalar(CHAR_SCALE);
        player.mesh.position.set(-3, 20, 0);

        player.mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(player.mesh);

        player.mixer = new THREE.AnimationMixer(player.mesh);
        
        if (object.animations && object.animations.length > 0) {
            const idleAction = player.mixer.clipAction(object.animations[0]);
            player.actions['idle'] = idleAction;
            player.currentAction = idleAction;
            idleAction.play();
        }

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

export function updatePlayer(playerRef, camera, delta) {
    if (!playerRef || !playerRef.mesh) return;
    
    if (playerRef.mixer) playerRef.mixer.update(delta);
    
    const speed = vrInput.run ? playerRef.speed * 2 : playerRef.speed;
    const moveSpeed = speed * delta;
    
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.length() > 0) direction.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    
    playerRef.mesh.position.addScaledVector(direction, -vrInput.moveY * moveSpeed);
    playerRef.mesh.position.addScaledVector(right, vrInput.moveX * moveSpeed);
    
    if (playerRef.attackCooldown > 0) {
        playerRef.attackCooldown -= delta;
    }
    
    let targetAnimation = 'idle';
    let canAct = playerRef.attackCooldown <= 0;
    
    if (!canAct && (playerRef.currentState === 'punch' || playerRef.currentState === 'kick' || playerRef.currentState === 'block')) {
        targetAnimation = playerRef.currentState;
    } else {
        playerRef.currentState = 'idle';
        playerRef.isBlocking = vrInput.block;
    }
    
    if (canAct) {
        if (vrInput.block) {
            targetAnimation = 'block';
            playerRef.currentState = 'block';
            playerRef.isBlocking = true;
        } else if (vrInput.attack) {
            executeAttack(10, 0.65);
            targetAnimation = 'punch';
            playerRef.currentState = 'punch';
            canAct = false;
        } else if (vrInput.kick) {
            executeAttack(20, 0.85);
            targetAnimation = 'kick';
            playerRef.currentState = 'kick';
            canAct = false;
        }
    }
    
    if (canAct && !vrInput.block && (Math.abs(vrInput.moveX) > 0 || Math.abs(vrInput.moveY) > 0)) {
        targetAnimation = 'walk';
        playerRef.currentState = 'walk';
        
        const move = new THREE.Vector3();
        move.addScaledVector(direction, -vrInput.moveY);
        move.addScaledVector(right, vrInput.moveX);
        if (move.length() > 0) move.normalize();
        
        const targetRotation = Math.atan2(move.x, move.z);
        playerRef.mesh.rotation.y += (targetRotation - playerRef.mesh.rotation.y) * 0.15;
    }
    
    fadeToAction(targetAnimation);
    groundSnap(playerRef.mesh);
}

export function groundSnap(mesh) {
    if (!physics?.raycaster && typeof physics?.getColliders !== 'function') return;
    
    const origin = mesh.position.clone();
    origin.y += 2;
    
    physics.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
    physics.raycaster.far = 100;
    
    const hits = physics.raycaster.intersectObjects(physics.getColliders(), true);
    if (hits.length > 0) {
        mesh.position.y = hits[0].point.y;
    }
}

export function getPlayerAABB() {
    if (!player.mesh) return null;
    const pos = player.mesh.position;
    return new THREE.Box3(
        new THREE.Vector3(pos.x - CHAR_RADIUS, pos.y, pos.z - CHAR_RADIUS),
        new THREE.Vector3(pos.x + CHAR_RADIUS, pos.y + CHAR_HEIGHT, pos.z + CHAR_RADIUS)
    );
}

function executeAttack(damageValue, cooldownTime) {
    player.attackCooldown = cooldownTime;
    playHitSound();
    
    if (enemy && enemy.mesh) {
        const attackReach = CHAR_RADIUS * 2 + 1.0; 
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