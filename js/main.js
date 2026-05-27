import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/webxr/VRButton.js';
import { initScene, scene, camera, renderer, updateCamera, updateVRPanel } from './scene.js';
import { initPlayer, updatePlayer, player } from './player.js';
import { initEnemy, updateEnemy, enemy } from './enemy.js';
import { initControls, updateVRControls } from './controls.js';
import { updateUI } from './ui.js';

const clock = new THREE.Clock();
const loadingManager = new THREE.LoadingManager();

initScene();
initControls(renderer);
initPlayer();
initEnemy(loadingManager);

// WebXR
renderer.xr.enabled = true;
const vrButton = VRButton.createButton(renderer);
vrButton.style.cssText += '; bottom: 60px; z-index: 1000;'; 
document.body.appendChild(vrButton);

renderer.xr.addEventListener('sessionstart', () => {
    document.getElementById('ui').classList.add('hidden');
    console.log('[VR] Sesión VR iniciada - Meta Quest 3');
});

renderer.xr.addEventListener('sessionend', () => {
    if (gameState === 'playing') {
        document.getElementById('ui').classList.remove('hidden');
        console.log('[VR] Sesión VR finalizada');
    }
});

let gameState = 'loading';
const loadingScreen = document.getElementById('loadingScreen');
const loadingProgress = document.getElementById('loadingProgress');
const startScreen = document.getElementById('startScreen');
const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volumeSlider');
const bgMusic = document.getElementById('bgMusic');
const uiLayer = document.getElementById('ui');

let playerWins = parseInt(localStorage.getItem('arena_playerWins') || '0');
let enemyWins = parseInt(localStorage.getItem('arena_enemyWins') || '0');

function updateScoreDisplay() {
    const text = `Victorias: ${playerWins} - Derrotas: ${enemyWins}`;
    document.getElementById('winScoreDisplay').innerText = text;
    document.getElementById('loseScoreDisplay').innerText = text;
}
updateScoreDisplay();

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const progress = (itemsLoaded / itemsTotal) * 100;
    if(loadingProgress) loadingProgress.style.width = `${progress}%`;
};

loadingManager.onLoad = function () {
    setTimeout(() => {
        if(loadingScreen) loadingScreen.classList.add('hidden');
        if(startScreen) startScreen.classList.remove('hidden');
        gameState = 'menu';
    }, 500);
};

loadingManager.onError = function (url) {
    console.error('[ERROR RED] No se pudo cargar: ' + url);
};

volumeSlider.addEventListener('input', (e) => {
    bgMusic.volume = e.target.value;
});

playBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    if (!renderer.xr.isPresenting) {
        uiLayer.classList.remove('hidden');
    }
    bgMusic.play().catch(e => console.log('Autoplay bloqueado', e));
    gameState = 'playing';
});

function animate() {
    const delta = clock.getDelta();
    
    updateVRControls(renderer);

    if (player?.mesh) updatePlayer(player, camera, delta);
    if (enemy?.mesh) updateEnemy(delta, player, gameState === 'playing');

    if (gameState === 'playing') {
        if (renderer.xr.isPresenting) {
            updateVRPanel(player.health, player.energy, enemy.health);
        } else {
            updateUI();
        }

        if (enemy.health <= 0) {
            gameState = 'gameover';
            playerWins++;
            localStorage.setItem('arena_playerWins', playerWins);
            updateScoreDisplay();
            document.getElementById('ui').classList.add('hidden');
            document.getElementById('winScreen').classList.remove('hidden');
        } else if (player.health <= 0) {
            gameState = 'gameover';
            enemyWins++;
            localStorage.setItem('arena_enemyWins', enemyWins);
            updateScoreDisplay();
            document.getElementById('ui').classList.add('hidden');
            document.getElementById('loseScreen').classList.remove('hidden');
        }
    }
    updateCamera(player, enemy);
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);