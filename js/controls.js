export let keys = {};
export let stateToggle = false;
let ePressedLastFrame = false;

export let vrInput = {
    moveX: 0,
    moveY: 0,
    rotateX: 0, // NUEVO: Guarda el movimiento horizontal del joystick derecho
    run: false,
    attack: false,
    kick: false,
    block: false
};

export function initControls(renderer) {
    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === 'e') {
            stateToggle = !stateToggle;
        }
    });

    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
}

export function updateVRControls(renderer) {
    if (!renderer.xr.isPresenting) return;

    keys['w'] = false;
    keys['s'] = false;
    keys['a'] = false;
    keys['d'] = false;
    keys['k'] = false;
    keys['l'] = false;
    keys['b'] = false;
    keys['shift'] = false;

    vrInput.moveX = 0;
    vrInput.moveY = 0;
    vrInput.rotateX = 0; // Reseteo en cada frame
    vrInput.run = false;
    vrInput.attack = false;
    vrInput.kick = false;
    vrInput.block = false;

    const session = renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
        if (!source.gamepad) continue;
        const gp = source.gamepad;

        // Mando Izquierdo: Movimiento y acciones secundarias
        if (source.handedness === 'left') {
            const xAxis = gp.axes[2] ?? 0;
            const yAxis = gp.axes[3] ?? 0;
            const deadzone = 0.25;

            if (yAxis < -deadzone) keys['w'] = true;
            if (yAxis > deadzone) keys['s'] = true;
            if (xAxis < -deadzone) keys['a'] = true;
            if (xAxis > deadzone) keys['d'] = true;

            vrInput.moveX = Math.abs(xAxis) > deadzone ? xAxis : 0;
            vrInput.moveY = Math.abs(yAxis) > deadzone ? yAxis : 0;

            if (gp.buttons[0]?.pressed) {
                keys['shift'] = true;
                vrInput.run = true;
            }
            if (gp.buttons[3]?.pressed) {
                keys['k'] = true;
                vrInput.attack = true;
            }
            if (gp.buttons[4]?.pressed) {
                keys['l'] = true;
                vrInput.kick = true;
            }
        }

        // Mando Derecho: Rotación de cámara y combate principal
        if (source.handedness === 'right') {
            const xAxisRight = gp.axes[2] ?? 0; // Captura el movimiento horizontal del stick derecho
            const deadzone = 0.25;
            vrInput.rotateX = Math.abs(xAxisRight) > deadzone ? xAxisRight : 0;

            const aPressed = gp.buttons[3]?.pressed ?? false;
            if (aPressed && !ePressedLastFrame) {
                stateToggle = !stateToggle;
                keys['e'] = true;
            } else {
                keys['e'] = false;
            }
            ePressedLastFrame = aPressed;

            if (gp.buttons[4]?.pressed) {
                keys['b'] = true;
                vrInput.block = true;
            }
            if (gp.buttons[1]?.pressed) {
                keys['b'] = true;
                vrInput.block = true;
            }
        }
    }
}

export function getControlsDebugInfo(renderer) {
    if (!renderer.xr.isPresenting) return null;
    const session = renderer.xr.getSession();
    if (!session) return null;

    const info = {};
    for (const source of session.inputSources) {
        if (!source.gamepad) continue;
        info[source.handedness] = {
            axes: Array.from(source.gamepad.axes).map(v => v.toFixed(2)),
            buttons: source.gamepad.buttons.map((b, i) => b.pressed ? i : null).filter(i => i !== null)
        };
    }
    return info;
}