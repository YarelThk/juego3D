import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

import { initScene, scene, camera, renderer, updateCamera } from './scene.js';
import { initPlayer, updatePlayer, player } from './player.js';
import { initEnemy, updateEnemy, enemy } from './enemy.js';
import { initControls } from './controls.js';
import { updateUI } from './ui.js';

let clock = new THREE.Clock();

initScene();
initControls();
initPlayer();
initEnemy();

function animate() {
    requestAnimationFrame(animate);

    let delta = clock.getDelta();

    updatePlayer(delta);
    updateEnemy(delta);
    updateCamera(player, enemy); // cámara aquí
    updateUI();

    renderer.render(scene, camera);
}

animate();