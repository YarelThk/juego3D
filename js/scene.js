import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

export let scene, camera, renderer;

export function initScene() {
    scene = new THREE.Scene();

    // cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // luces
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    // piso
    const geometry = new THREE.PlaneGeometry(50, 50);
    const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // CREA MUROS
    createWalls();
}

export function updateCamera(player, enemy) {
    if (!player || !enemy) return;
    if (!player.mesh || !enemy.mesh) return;

    const midpoint = player.mesh.position.clone()
        .add(enemy.mesh.position)
        .multiplyScalar(0.5);

    const direction = player.mesh.position.clone()
        .sub(enemy.mesh.position)
        .normalize();

    const offset = direction.multiplyScalar(8);
    offset.y = 4;

    const desiredPosition = midpoint.clone().add(offset);

    camera.position.lerp(desiredPosition, 0.1);
    camera.lookAt(midpoint);
}

// función separada
function createWalls() {
    function createWall(x, z, width, depth) {
        const geo = new THREE.BoxGeometry(width, 2, depth);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const wall = new THREE.Mesh(geo, mat);
        wall.position.set(x, 1, z);
        scene.add(wall);
    }

    createWall(0, -25, 50, 1);
    createWall(0, 25, 50, 1);
    createWall(-25, 0, 1, 50);
    createWall(25, 0, 1, 50);
}