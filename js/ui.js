import { player } from './player.js';
import { enemy } from './enemy.js';

export function updateUI() {
    document.getElementById("playerHealth").style.width = player.health + "%";
    document.getElementById("playerEnergy").style.width = player.energy + "%";
    document.getElementById("enemyHealth").style.width = enemy.health + "%";
}