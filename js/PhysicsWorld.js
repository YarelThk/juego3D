import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

export class PhysicsWorld {

    constructor(scene, getColliders) {

        this.scene = scene;
        this.getColliders = getColliders;

        this.raycaster = new THREE.Raycaster();
    }

    // ─────────────────────────────
    // 🔽 SUELO REAL
    // ─────────────────────────────
    isGrounded(position, distance = 1.3) {

        const origin = position.clone();
        origin.y += 2;

        this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));

        const hits = this.raycaster.intersectObjects(
            this.getColliders(),
            true
        );

        return hits.length > 0 && hits[0].distance <= distance;
    }

    // ─────────────────────────────
    // ➡️ PAREDES / OBSTÁCULOS
    // ─────────────────────────────
    forwardCollision(position, direction, distance = 0.6) {

        this.raycaster.set(
            new THREE.Vector3(position.x, position.y + 1, position.z),
            direction.clone().normalize()
        );

        const hits = this.raycaster.intersectObjects(
            this.getColliders(),
            true
        );

        return hits.length > 0 && hits[0].distance <= distance;
    }

    // ─────────────────────────────
    // 🧠 CAPSULE SIMPLE
    // ─────────────────────────────
    canMove(position, direction, step = 0.3) {

        if (!direction || direction.length() === 0) return true;

        const dir = direction.clone().normalize();

        const center = this.forwardCollision(position, dir, step);

        const left = this.forwardCollision(
            position,
            dir.clone().add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.35)),
            step
        );

        const right = this.forwardCollision(
            position,
            dir.clone().add(new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(0.35)),
            step
        );

        if (center || left || right) return false;

        // Límite estricto de distancia para delimitar la arena de pelea (evita que caminen fuera del mapa)
        const nextPos = position.clone().add(dir.clone().multiplyScalar(step));
        const limiteArena = 28; // Radio seguro para no salir del escenario
        const distFromCenter = Math.sqrt(nextPos.x * nextPos.x + nextPos.z * nextPos.z);
        
        if (distFromCenter > limiteArena) {
            return false; // Bloquea el movimiento si intentan salir de la arena
        }

        return true;
    }
}