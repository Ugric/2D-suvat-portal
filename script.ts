const canvas = document.getElementById("canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Canvas not found");
}
const ctx = canvas.getContext("2d");

const randomColor = () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 128);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r}, ${g}, ${b})`;
};

const gameWindow = {
    width: 25,
    height: 25,
};

interface Point {
    x: number;
    y: number;
}

interface Gradient {
    m: number;
}

function findIntersection(
    gradient1: Gradient,
    point1: Point,
    gradient2: Gradient,
    point2: Point
): Point | null {
    // Calculate the x-coordinate of the intersection point
    const x =
        (point2.y -
            point1.y +
            point1.x * gradient1.m -
            point2.x * gradient2.m) /
        (gradient1.m - gradient2.m);

    // If gradients are parallel, there is no intersection
    if (gradient1.m === gradient2.m) {
        return null;
    }

    // Calculate the y-coordinate of the intersection point
    const y = gradient1.m * (x - point1.x) + point1.y;

    return { x, y };
}

let paused = false;

let unfocused = false;
window.addEventListener("blur", () => {
    unfocused = true;
});
window.addEventListener("mouseout", () => {
    currentlyClickedParticle = null;
});
window.addEventListener("focus", () => {
    unfocused = false;
});

let controllingPortal = 0;

window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault()
    const portal = portals[controllingPortal];
    switch (e.key) {
        case "Tab":
            controllingPortal = (controllingPortal + 1) % portals.length;
            break;
        case " ":
            paused = !paused;
            break;
        case "e":
            portal.rotation += 5;
            portal.rotation = portal.rotation % 360;
            break;
        case "q":
            portal.rotation -= 5;
            portal.rotation = portal.rotation % 360;
            break;
        case "a":
            portal.x -= 0.5;
            break;
        case "d":
            portal.x += 0.5;
            break;
        case "w":
            portal.y -= 0.5;
            break;
        case "s":
            portal.y += 0.5;
            break;
        case "r":
            particles = [];
            break;
        case "p":
            if (!mouse.hovering || currentlyClickedParticle !== null) {
                return;
            }
            particles.push(particle(mouse.x, mouse.y, 1, randomColor()));
            break;
        case "g":
            environment.gravity = environment.gravity === 0 ? 9.81 : 0;
            break;
    }
});

if (!ctx) {
    throw new Error("Context not found");
}

const environment = {
    gravity: 9.81,
    terminalVelocity: 100,
};

const setSize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

let currentID = 0;

type Particle = {
    draw: () => void;
    physics: (delta: number) => void;
    id: number;
    insidePortal: boolean;
    x: number;
    y: number;
    vertical: {
        velocity: number;
        acceleration: number;
    };
    horizontal: {
        velocity: number;
        acceleration: number;
    };
    radius: number;
    color: string;
    bouncyness: number;
};

let currentlyClickedParticle: null | number = null;

function particle(
    x: number,
    y: number,
    radius: number,
    color: string,
    bouncyness = 0.8
): Particle {
    const particle = {
        id: currentID++,
        draw: () => {
            if (!ctx) {
                throw new Error("Context not found");
            }
            ctx.beginPath();
            ctx.fillStyle = particle.color;
            ctx.arc(particle.x, particle.y, particle.radius, 0, 2 * Math.PI);
            ctx.fill();
        },
        physics: (delta: number) => {
            let deltaY: number;
            let newY: number;
            let newYVelocity: number;
            let deltaX: number;
            let newX: number;
            let newXVelocity: number;
            {
                // s = ut + 1/2at^2
                const verticalAcceleration =
                    environment.gravity + particle.vertical.acceleration;
                deltaY =
                    particle.vertical.velocity * delta +
                    0.5 * verticalAcceleration * delta * delta;
                newYVelocity =
                    particle.vertical.velocity + verticalAcceleration * delta;
                newY = particle.y + deltaY;
            }

            // horizontal
            {
                const horizontalAcceleration = particle.horizontal.acceleration;
                deltaX =
                    particle.horizontal.velocity * delta +
                    0.5 * horizontalAcceleration * delta * delta;
                newXVelocity =
                    particle.horizontal.velocity +
                    horizontalAcceleration * delta;
                newX = particle.x + deltaX;
            }

            // Check for portal collisions

            // portals a
            for (const portal of portals) {
                const portalGradient = {
                    m: Math.tan((portal.rotation * Math.PI) / 180),
                };
                const particleGradient = {
                    m: (newY - particle.y) / (newX - particle.x),
                };
                particleGradient.m =
                    particleGradient.m === Infinity
                        ? 999999
                        : particleGradient.m === -Infinity
                        ? 999999
                        : particleGradient.m;
                const intersection = findIntersection(
                    portalGradient,
                    portal,
                    particleGradient,
                    { x: newX, y: newY }
                );
                if (intersection) {
                    const distanceFromIntersection = Math.sqrt(
                        (intersection.x - portal.x) *
                            (intersection.x - portal.x) +
                            (intersection.y - portal.y) *
                                (intersection.y - portal.y)
                    );
                    if (distanceFromIntersection < portal.length / 2) {
                        const distanceFromIntersectionParticle = Math.sqrt(
                            (intersection.x - particle.x) *
                                (intersection.x - particle.x) +
                                (intersection.y - particle.y) *
                                    (intersection.y - particle.y)
                        );
                        const deltaDistance = Math.sqrt(
                            (newX - particle.x) * (newX - particle.x) +
                                (newY - particle.y) * (newY - particle.y)
                        );
                        if (distanceFromIntersectionParticle <= deltaDistance) {
                            const deltaPassedDistance =
                                deltaDistance -
                                distanceFromIntersectionParticle;
                            if (!particle.insidePortal) {
                                const angle =(
                                    (Math.atan2(
                                        intersection.y - particle.y,
                                        intersection.x - particle.x
                                    ) *
                                        180) /
                                        Math.PI -
                                    (portal.rotation + 90)) % 360;
                                if (angle > -90 && angle < 90) {
                                    const newangle =
                                        -angle - portal.connected.rotation;
                                    const newangleRad =
                                        (newangle * Math.PI) / 180;
                                    const newVelocity =
                                        Math.sqrt(
                                            particle.vertical.velocity *
                                                particle.vertical.velocity +
                                                particle.horizontal.velocity *
                                                    particle.horizontal.velocity
                                        );
                                    newYVelocity =
                                        -Math.cos(newangleRad) * newVelocity;
                                    newXVelocity =
                                        -Math.sin(newangleRad) * newVelocity;
                                    newX = portal.connected.x;
                                    newY = portal.connected.y;
                                    newY -=
                                        Math.cos(newangleRad) *
                                        deltaPassedDistance;
                                    newX -=
                                        Math.sin(newangleRad) *
                                        deltaPassedDistance;
                                }
                                particle.insidePortal = true;
                            }
                        }
                        break;
                    }
                }
            }

            // Check for wall collisions
            if (newX - particle.radius < 0) {
                newX = particle.radius;
                newXVelocity = -newXVelocity * particle.bouncyness;
            } else if (newX + particle.radius > gameWindow.width) {
                newX = gameWindow.width - particle.radius;
                newXVelocity = -newXVelocity * particle.bouncyness;
            }

            if (newY - particle.radius < 0) {
                newY = particle.radius;
                newYVelocity = -newYVelocity * particle.bouncyness;
            } else if (newY + particle.radius > gameWindow.height) {
                newY = gameWindow.height - particle.radius;
                newYVelocity = -newYVelocity * particle.bouncyness;
            }

            // terminal velocity
            if (newYVelocity > environment.terminalVelocity) {
                newYVelocity = environment.terminalVelocity;
            } else if (newYVelocity < -environment.terminalVelocity) {
                newYVelocity = -environment.terminalVelocity;
            }

            if (newXVelocity > environment.terminalVelocity) {
                newXVelocity = environment.terminalVelocity;
            } else if (newXVelocity < -environment.terminalVelocity) {
                newXVelocity = -environment.terminalVelocity;
            }

            // Done!
            particle.x = newX;
            particle.y = newY;
            particle.vertical.velocity = newYVelocity;
            particle.horizontal.velocity = newXVelocity;

            if (currentlyClickedParticle === particle.id) {
                const distanceX = mouse.x - particle.x;
                const distanceY = mouse.y - particle.y;
                particle.horizontal.velocity = distanceX * delta * 1000;
                particle.vertical.velocity = distanceY * delta * 1000;
            }
        },
        x,
        y,
        vertical: {
            velocity: 0,
            acceleration: 0,
        },
        horizontal: {
            velocity: 0,
            acceleration: 0,
        },
        radius,
        color,
        bouncyness,
        insidePortal: false,
    };
    return particle;
}

window.addEventListener("resize", setSize);
window.addEventListener("orientationchange", setSize);

let timeLastFrame: null | number = null;

let particles: Particle[] = [];

canvas.addEventListener("mousedown", () => {
    if (!mouse.hovering || currentlyClickedParticle !== null) {
        return;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < particle.radius) {
            currentlyClickedParticle = particle.id;
            break;
        }
    }
});

canvas.addEventListener("mouseup", () => {
    currentlyClickedParticle = null;
});

interface Portal {
    x: number;
    length: number;
    y: number;
    rotation: number;
    color: string;
    connected: Portal;
}

function initPortals(): Portal[] {
    const portalA = {
        x: 5.5,
        y: gameWindow.height - 1,
        length: 10,
        rotation: 0,
        color: "#ffaa00",
    } as Portal;
    const portalB: Portal = {
        x: gameWindow.width - 5,
        y: gameWindow.height / 2,
        rotation: -45,
        length: 10,
        color: "#0000ff",
        connected: portalA,
    };
    portalA.connected = portalB;
    return [portalA, portalB];
}

let portals = initPortals();

setSize();

const mouse = {
    x: gameWindow.width / 2,
    y: gameWindow.height / 2,
    hovering: false,
};

// Add event listener for mouse movement
canvas.addEventListener("mousemove", (event) => {
    // Calculate the mouse position relative to the canvas
    const rect = canvas.getBoundingClientRect();

    // Calculate the mouse position relative to the game window
    const scaleX = canvas.width / gameWindow.width;
    const scaleY = canvas.height / gameWindow.height;
    const scale = Math.min(scaleX, scaleY);

    // Calculate the centered position for the game window
    const gameWindowWidth = gameWindow.width * scale;
    const gameWindowHeight = gameWindow.height * scale;
    const xOffset = (canvas.width - gameWindowWidth) / 2;
    const yOffset = (canvas.height - gameWindowHeight) / 2;
    const canvasMouseX = event.clientX - rect.left;
    const canvasMouseY = event.clientY - rect.top;

    const mouseX = (canvasMouseX - xOffset) / scale;
    const mouseY = (canvasMouseY - yOffset) / scale;

    if (
        mouseX >= 0 &&
        mouseX <= gameWindow.width &&
        mouseY >= 0 &&
        mouseY <= gameWindow.height
    ) {
        mouse.hovering = true;
        mouse.x = mouseX;
        mouse.y = mouseY;
    } else {
        mouse.hovering = false;
    }
});

const draw = () => {
    if (!ctx) {
        throw new Error("Context not found");
    }

    const timeNow = performance.now();
    if (timeLastFrame === null) {
        timeLastFrame = timeNow;
    }
    const timeDelta = timeNow - timeLastFrame;
    timeLastFrame = timeNow;

    // Calculate the scale factor
    const scaleX = canvas.width / gameWindow.width;
    const scaleY = canvas.height / gameWindow.height;
    const scale = Math.min(scaleX, scaleY);

    // Calculate the centered position for the game window
    const gameWindowWidth = gameWindow.width * scale;
    const gameWindowHeight = gameWindow.height * scale;
    const xOffset = (canvas.width - gameWindowWidth) / 2;
    const yOffset = (canvas.height - gameWindowHeight) / 2;

    // Scale and translate the context to fit the game window
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(xOffset / scale, yOffset / scale);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, gameWindow.width, gameWindow.height);

    // Draw the particles
    // Update the particles
    if (mouse.hovering && currentlyClickedParticle !== null) {
        canvas.style.cursor = "grabbing";
    } else {
        canvas.style.cursor = "default";
    }
    particles.forEach((p) => {
        if (!paused && !unfocused) {
            p.physics(timeDelta / 1000);
        }
        p.draw();
        if (canvas.style.cursor != "default") return;
        const distanceX = mouse.x - p.x;
        const distanceY = mouse.y - p.y;
        const distance = Math.sqrt(
            distanceX * distanceX + distanceY * distanceY
        );
        if (distance < p.radius) {
            canvas.style.cursor = "grab";
        }
    });

    // Draw the portals
    for (const portal of portals) {
        ctx.lineWidth = 1;

        ctx.strokeStyle = portal.color;
        ctx.save();
        ctx.translate(portal.x, portal.y);
        ctx.rotate((portal.rotation * Math.PI) / 180);
        ctx.beginPath();
        ctx.moveTo(-portal.length / 2, 0);
        ctx.lineTo(portal.length / 2, 0);
        ctx.stroke();

        // Draw wall underneath the portal
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-portal.length / 2, 0.5); // Start from the bottom-left corner of the portal
        ctx.lineTo(portal.length / 2, 0.5); // Draw a line to the bottom-right corner of the portal
        ctx.stroke();

        ctx.restore();
    }

    if (paused || unfocused) {
        timeLastFrame = null;
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, gameWindow.width, gameWindow.height);
        ctx.fillStyle = "white";
        ctx.font = "2.5px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Paused", gameWindow.width / 2, gameWindow.height / 2);
    }

    // Restore the context
    ctx.restore();

    // Draw black bars
    ctx.save();
    ctx.fillStyle = "black";
    if (xOffset > yOffset) {
        ctx.fillRect(0, 0, xOffset, canvas.height);
        ctx.fillRect(canvas.width - xOffset, 0, xOffset, canvas.height);
    } else if (yOffset > xOffset) {
        ctx.fillRect(0, 0, canvas.width, yOffset);
        ctx.fillRect(0, canvas.height - yOffset, canvas.width, yOffset);
    }

    ctx.restore();
    requestAnimationFrame(draw);
};

requestAnimationFrame(draw);
