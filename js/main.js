import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

import { initScene, scene, camera, renderer, updateCamera } from './scene.js';
import { initPlayer, updatePlayer, player } from './player.js';
import { initEnemy, updateEnemy, enemy } from './enemy.js';
import { initControls } from './controls.js';
import { updateUI } from './ui.js';

const clock = new THREE.Clock();

initScene();
initControls();
initPlayer();
initEnemy();

function animate() {

    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // 🧠 seguridad por carga async
    if (player?.mesh) updatePlayer(delta);
    if (enemy?.mesh) updateEnemy(delta, player);

    updateCamera(player, enemy);
    updateUI();

    renderer.render(scene, camera);
}

animate();