import { k } from "../App";
import { getStateCallbacks, Room } from "colyseus.js";
import { MyRoomState, Player } from "../../../server/src/rooms/schema/MyRoomState";
import { GameObj } from "kaplay";
import { showGameOptionsOverlay, hideGameOptionsOverlay } from "../UI/GameOptionsOverlay";

/**
 * Stores all active players keyed by their session ID.
 * Each entry holds both the player sprite and the gun sprite.
 */
const allPlayers = new Map<string, {
  playerSprite: GameObj,
  gunSprite: GameObj,
  isDead?: boolean,
  isInvincible?: boolean,
}>();

/**
 * Stores opponent aiming data for smooth interpolation.
 * Each entry keeps track of the current angle and the target angle.
 */
const opponentAimData = new Map<string, { currentAngle: number; targetAngle: number }>();

/**
 * Reference to the local player's sprite for camera tracking.
 */
let localPlayerSprite: GameObj | null = null;

/**
 * Local State for Gun related UI elements
 */
let gameStateText: GameObj;
let ammoText: GameObj;
let killText: GameObj;
let timerText: GameObj;

let overlayUI: GameObj | null = null;
let overlayVisible = false;

// Helpers to hide/show visuals consistently
function hidePlayerVisuals(entry: { playerSprite: GameObj, gunSprite: GameObj }) {
  const ps = entry.playerSprite;
  const gs = entry.gunSprite ?? (ps as any).__gunSprite;
  const hb = (ps as any).__healthBar;

  ps.opacity = 0;
  if (gs) gs.opacity = 0;
  if (hb) hb.opacity = 0;

  // remember that it's hidden (useful for respawn logic)
  (ps as any).__isHiddenForDeath = true;
}

function showPlayerVisuals(entry: { playerSprite: GameObj, gunSprite: GameObj }) {
  const ps = entry.playerSprite;
  const gs = entry.gunSprite ?? (ps as any).__gunSprite;
  const hb = (ps as any).__healthBar;

  ps.opacity = 1;
  if (gs) gs.opacity = 1;
  if (hb) hb.opacity = 1;

  (ps as any).__isHiddenForDeath = false;
}

// Shield creation / removal, tracked on sprite (__shield)
function showInvincibilityShield(entry: { playerSprite: GameObj }, durationSeconds?: number) {
  const ps = entry.playerSprite;
  // avoid double-adding
  if ((ps as any).__shield) return;

  const shield = ps.add([
    k.circle(28),
    k.color(0, 255, 255),
    k.opacity(0.35),
    k.anchor("center"),
    k.z(22),
  ]);
  (ps as any).__shield = shield;

  if (durationSeconds) {
    k.wait(durationSeconds, () => {
      if ((ps as any).__shield) {
        k.destroy((ps as any).__shield);
        (ps as any).__shield = null;
      }
    });
  }
}

function removeInvincibilityShield(entry: { playerSprite: GameObj }) {
  const ps = entry.playerSprite;
  if ((ps as any).__shield) {
    k.destroy((ps as any).__shield);
    (ps as any).__shield = null;
  }
}


/**
 * Scene: Lobby
 * Handles the map, player creation/removal, local input, and message subscriptions.
 */
export function createLobbyScene() {
  k.scene("lobby", (room: Room<MyRoomState>) => {
    const $ = getStateCallbacks(room);
    const spritesBySessionId: Record<string, GameObj> = {};

    // Load Map
    room.send("request-map");
    room.onMessage("map-info", async (mapName) => {
      k.loadSprite("map", `assets/maps/${mapName}.png`);
      k.add([k.sprite("map"), k.pos(0, 0), k.anchor("topleft"), k.z(-1)]);
    });

    // **Global HUD**
    const gameStateText = k.add([k.text("Waiting for players...", { size: 18 }), k.pos(k.width() / 2, 80), k.anchor("center"), k.color(255, 255, 255), k.fixed(), k.z(100)]);
    const timerText = k.add([k.text("", { size: 18 }), k.pos(k.width() / 2, 110), k.anchor("center"), k.color(255, 255, 255), k.fixed(), k.z(100)]);
    const scoreText = k.add([k.text("Objective: 40 points to win", { size: 16 }), k.pos(k.width() / 2, 20), k.anchor("center"), k.color(255, 255, 255), k.fixed()]);
    const statusText = k.add([k.text("Match starting...", { size: 14 }), k.pos(k.width() / 2, 50), k.anchor("center"), k.color(255, 255, 255), k.fixed()]);

    // **Game State Changes**
    $(room.state).listen("gameState", (newState) => {
      if (newState === "waiting") {
        gameStateText.text = "Waiting for players...";
        timerText.text = "";
      } else if (newState === "countdown") {
        gameStateText.text = "Match starting soon!";
      } else if (newState === "in-progress") {
        gameStateText.text = "Match in progress!";
      } else if (newState === "ended") {
        gameStateText.text = "Round Over!";
      }
    });

    $(room.state).listen("countdown", (value) => {
      if (room.state.gameState === "countdown") {
        timerText.text = `Match starts in: ${value}s`;
      }
    });

    $(room.state).listen("roundTime", (value) => {
      if (room.state.gameState === "in-progress") {
        const mins = Math.floor(value / 60);
        const secs = value % 60;
        timerText.text = `Time left: ${mins}:${secs.toString().padStart(2, "0")}`;
      }
    });

    // **Score Updates**
    $(room.state).onChange(() => {
      const red = room.state.redScore;
      const blue = room.state.blueScore;
      scoreText.text = `Red: ${red} | Blue: ${blue} (40 to win)`;

      if (red > blue) {
        statusText.text = "Team Red is winning!";
        statusText.color = k.rgb(255, 50, 50);
      } else if (blue > red) {
        statusText.text = "Team Blue is winning!";
        statusText.color = k.rgb(50, 50, 255);
      } else {
        statusText.text = "It's a tie!";
        statusText.color = k.rgb(255, 255, 255);
      }
    });

    // **Handle Player Join**
    $(room.state).players.onAdd((player, sessionId) => {
      const { playerSprite, gunSprite } = createPlayer(player);
      spritesBySessionId[sessionId] = playerSprite;
      allPlayers.set(sessionId, { playerSprite, gunSprite });

      // listen to that player's isInvincible field
      $(player).listen("isInvincible", (val: boolean) => {
        const entry = allPlayers.get(sessionId);
        if (!entry) return;
        if (val) showInvincibilityShield(entry);
        else removeInvincibilityShield(entry);
      });

      // handle death if server changes isAlive (optional)
      $(player).listen("isAlive", (val: boolean) => {
        const entry = allPlayers.get(sessionId);
        if (!entry) return;
        if (!val) {
          // server flipped alive -> false (dead)
          // do the same hide + dissipate
          hidePlayerVisuals(entry);
          removeInvincibilityShield(entry);
        } else {
          // respawn via schema change
          showPlayerVisuals(entry);
        }
      });

      if (sessionId === room.sessionId) {
        setupLocalPlayerControls(sessionId, room, $);
      }
    });

    // **Handle Player Leave**
    $(room.state).players.onRemove((_, sessionId) => {
      k.destroy(spritesBySessionId[sessionId]);
      delete spritesBySessionId[sessionId];
      allPlayers.delete(sessionId);
    });

    // **Aim Sync**
    room.onMessage("aim-taken", ({ playerId, target }) => {
      if (playerId === room.sessionId) return;
      const player = allPlayers.get(playerId);
      if (!player) return;
      const angle = k.vec2(target.x, target.y).sub(player.playerSprite.pos).angle();
      opponentAimData.set(playerId, { currentAngle: player.gunSprite.angle, targetAngle: angle });
    });

    // **Muzzle Flash**
    room.onMessage("player-fired", ({ playerId }) => {
      const player = allPlayers.get(playerId);
      if (!player) return;
      const flash = player.gunSprite.add([
        k.pos(player.gunSprite.width * 2, Math.abs(player.gunSprite.angle) > 90 ? 7 : -7),
        k.circle(10),
        k.color(255, 255, 0),
        k.opacity(0.5),
      ]);
      flash.fadeOut(0.2).then(() => k.destroy(flash));
    });

    // **Hitmarker**
    room.onMessage("hit-effect", ({ point, type, dir }) => {
      if (!point) return;

      // color: red for player hit, greyish for walls
      const colorValue = type === "player" ? k.rgb(255, 0, 0) : k.rgb(140, 147, 176);

      // compute particle direction (reverse of shot dir), guard against missing dir
      const shotAngle = (dir && typeof dir.x === "number" && typeof dir.y === "number")
        ? k.vec2(dir.x, dir.y).scale(-1).angle()
        : 0;

      // guard: getSprite may be undefined during initial load
      const hex = k.getSprite("hexagon");
      const tex = hex && (hex as any).data ? (hex as any).data.tex : undefined;
      const quad = hex && (hex as any).data && (hex as any).data.frames ? (hex as any).data.frames[0] : undefined;

      // build particle config (omit texture/quads if not available)
      const particleConfig: any = {
        max: 20,
        speed: [200, 250],
        lifeTime: [0.2, 0.75],
        colors: [colorValue],
        opacities: [1.0, 0.0],
        angle: [0, 360],
      };
      if (tex) particleConfig.texture = tex;
      if (quad) particleConfig.quads = [quad];

      const emitterOpts = {
        lifetime: 0.75,
        rate: 0,
        direction: shotAngle,
        spread: 45,
      };

      const splatter = k.add([
        k.pos(point.x, point.y),
        k.particles(particleConfig, emitterOpts),
      ]);

      splatter.emit(10);
      splatter.onEnd(() => {
        k.destroy(splatter);
      });
    });

    // **Reload Animation**
    room.onMessage("player-reload-start", ({ playerId, reloadTime }) => {
      const player = allPlayers.get(playerId);
      if (!player) return;
      const spinner = player.gunSprite.add([k.sprite("reloadSpinner"), k.pos(20, -20), k.anchor("center"), k.z(50)]);
      spinner.play("spin");
      k.wait(reloadTime / 1000, () => spinner.destroy());
    });

    // When server says a player died
    room.onMessage("player-dead", ({ playerId }) => {
      const entry = allPlayers.get(playerId);
      if (!entry) return;

      // particle dissipate effect
      const ps = entry.playerSprite;
      const dissipate = k.add([
        k.pos(ps.pos),
        k.particles({
          max: 20,
          speed: [50, 100],
          angle: [0, 360],
          angularVelocity: [45, 90],
          lifeTime: [1.0, 1.5],
          colors: [k.rgb(128, 128, 255), k.rgb(255, 255, 255)],
          opacities: [0.1, 1.0, 0.0],
          texture: k.getSprite("star").data.tex,
          quads: [k.getSprite("star").data.frames[0]],
        }, {
          lifetime: 1.5,
          rate: 0,
          direction: -90,
          spread: 0,
        }),
      ]);
      dissipate.emit(20);
      dissipate.onEnd(() => k.destroy(dissipate));

      // hide visuals
      hidePlayerVisuals(entry);

      // remove any shield while dead
      removeInvincibilityShield(entry);
    });

    // When server says a player respawned
    room.onMessage("player-respawned", ({ playerId, x, y, isInvincible }) => {
      let entry = allPlayers.get(playerId);
      if (!entry) {
        // If not present client-side (possible late join), create sprite from state
        const pState = room.state.players.get(playerId);
        if (pState) {
          const { playerSprite, gunSprite } = createPlayer(pState);
          allPlayers.set(playerId, { playerSprite, gunSprite });
          // now update entry
          entry = allPlayers.get(playerId)!;
        } else {
          return;
        }
      }

      // reposition & show visuals
      entry.playerSprite.pos.x = x;
      entry.playerSprite.pos.y = y;
      showPlayerVisuals(entry);

      // short invincibility shield if server told us to
      if (isInvincible) {
        showInvincibilityShield(entry, 3); // 3 seconds local fallback
      }
    });

    // **Round Ended**
    room.onMessage("round-ended", ({ winner, redScore, blueScore }) => {
      k.destroy(timerText);
      k.add([k.text(`Round Over! Winner: ${winner}\nRed: ${redScore} | Blue: ${blueScore}`, { size: 24 }), k.pos(k.width() / 2, k.height() / 2), k.anchor("center"), k.color(255, 255, 0), k.z(999), k.fixed()]);
    });

    // **Options menu**
    // Trigger overlay with Tab
    k.onKeyPress("tab", () => {
      if (!overlayVisible) {
        overlayVisible = true;
        showGameOptionsOverlay(room);
      }
    });

    k.onKeyRelease("tab", () => {
      overlayVisible = false;
      hideGameOptionsOverlay();
    });

    // Optional: Button in corner to toggle
    const menuButton = k.add([
      k.rect(40, 40),
      k.color(50, 50, 50),
      k.pos(k.width() - 60, 20),
      k.anchor("topleft"),
      k.z(1000),
      k.fixed(),
      k.area(),
    ]);

    menuButton.add([
      k.text("≡", { size: 24 }),
      k.color(255, 255, 255),
      k.anchor("center"),
      k.pos(20, 20),
    ]);

    menuButton.onClick(() => {
      if (overlayVisible) {
        hideGameOptionsOverlay();
        overlayVisible = false;
      } else {
        showGameOptionsOverlay(room);
        overlayVisible = true;
      }
    });
  });
}


/**
 * Creates a new player sprite and associated gun.
 * Also sets up interpolation, animation switching, and camera tracking.
 */
function createPlayer(player: Player) {

  const avatarOffsets: Record<string, number> = {
    red: 0,
    blue: 9,
    blonde: 18,
  };

  const rowStart: number = avatarOffsets[player.avatar] ?? 0;

  k.loadSprite("all_avatars", "assets/player/neo_zero_char_01.png", {
    sliceX: 3,
    sliceY: 9,
    anims: {
      "idle-down": rowStart + 1,
      "walk-down": { from: rowStart, to: rowStart + 2, speed: 5, pingpong: true, loop: true },
      "idle-up": rowStart + 4,
      "walk-up": { from: rowStart + 3, to: rowStart + 5, speed: 5, pingpong: true, loop: true },
      "idle-side": rowStart + 7,
      "walk-side": { from: rowStart + 6, to: rowStart + 8, speed: 5, pingpong: true, loop: true },
    },
  });

  const playerSprite = k.add([
    k.sprite("all_avatars", { anim: "idle-down" }),
    k.pos(player.x, player.y),
    k.anchor("center"),
    k.scale(0.8),
    k.z(10),
  ]);

  const gunSprite = playerSprite.add([
    k.sprite("gun"),
    k.anchor(k.vec2(-2.5, 0)),
    k.scale(0.25),
    k.rotate(0),
  ]);
  (playerSprite as any).__gunSprite = gunSprite;

  const healthBar = playerSprite.add([
    k.pos(k.vec2(0, -15)),
    k.rect(20, 2),
    k.color(0, 255, 0), // green
    k.anchor("center"),
    k.z(21),
  ]);
  (playerSprite as any).__healthBar = healthBar;

  (playerSprite as any).__shield = null;
  (playerSprite as any).__isHiddenForDeath = false;

  setupPlayerInterpolation(playerSprite, gunSprite, player);
  setupCameraFollow(playerSprite);

  return { playerSprite, gunSprite };
}

/**
 * Sets up smooth interpolation for position, aiming, and animations.
 */
function setupPlayerInterpolation(playerSprite: GameObj, gunSprite: GameObj, player: Player) {
  let lastPos = k.vec2(player.x, player.y);
  let lastDir: "up" | "down" | "side" = "down";
  let currentAnim = "";

  k.onUpdate(() => {
    // Remote aiming interpolation
    for (const [playerId, data] of opponentAimData) {
      const opponent = allPlayers.get(playerId);
      if (!opponent) continue;

      data.currentAngle = k.lerp(data.currentAngle, data.targetAngle, 2 * k.dt());
      opponent.gunSprite.angle = data.currentAngle;
      opponent.gunSprite.flipY = Math.abs(data.currentAngle) > 90;
    }

    // Position interpolation
    playerSprite.pos.x = k.lerp(playerSprite.pos.x, player.x, 12 * k.dt());
    playerSprite.pos.y = k.lerp(playerSprite.pos.y, player.y, 12 * k.dt());

    // Animation switching
    const vel = playerSprite.pos.sub(lastPos);
    lastPos = playerSprite.pos.clone();
    let nextAnim = "";

    if (Math.abs(vel.x) > 0.1 || Math.abs(vel.y) > 0.1) {
      if (Math.abs(vel.x) > Math.abs(vel.y)) {
        playerSprite.flipX = vel.x < 0;
        nextAnim = "walk-side";
        lastDir = "side";
      } else if (vel.y < 0) {
        nextAnim = "walk-up";
        lastDir = "up";
      } else {
        nextAnim = "walk-down";
        lastDir = "down";
      }
    } else {
      nextAnim = `idle-${lastDir}`;
    }

    if (nextAnim !== currentAnim) {
      currentAnim = nextAnim;
      playerSprite.play(currentAnim);
    }
  });

  // Update healthbar every frame (inside interpolation loop or separate)
  k.onUpdate(() => {
    // ensure the player still exists in state
    const current = player;
    if (!current) return;
    const ratio = Math.max(0, Math.min(1, (current.health || 0) / 100));
    // guard for the objects (they exist as children)
    const hb = (playerSprite as any).__healthBar;
    if (hb) hb.width = 40 * ratio;
    // color change
    if (hb) {
      if (ratio < 0.3) hb.color = k.rgb(255, 0, 0);
      else if (ratio < 0.6) hb.color = k.rgb(255, 165, 0);
      else hb.color = k.rgb(0, 255, 0);
    }
  });
}

/**
 * Smooth camera follow for the local player.
 */
function setupCameraFollow(sprite: GameObj) {
  let camPos = k.vec2(0, 0);
  k.onUpdate(() => {
    if (localPlayerSprite) {
      camPos.x = k.lerp(camPos.x, localPlayerSprite.pos.x, 8 * k.dt());
      camPos.y = k.lerp(camPos.y, localPlayerSprite.pos.y, 8 * k.dt());
      k.setCamPos(camPos);
      k.setCamScale(3);
    }
  });
}

/**
 * Local player aiming setup.
 * Sends aiming data periodically to reduce bandwidth usage.
 */
function setupLocalPlayerControls(sessionId: string, room: Room<MyRoomState>, $: ReturnType<typeof getStateCallbacks>) {
  localPlayerSprite = allPlayers.get(sessionId)?.playerSprite ?? null;
  let lastAimSent = 0;

  // **Local HUD**
  ammoText = k.add([k.text("", { size: 16 }), k.pos(16, k.height() - 32), k.fixed(), k.color(255, 255, 255), k.z(100)]);
  killText = k.add([k.text("Kills: 0", { size: 16 }), k.pos(16, k.height() - 64), k.fixed(), k.color(255, 255, 255), k.z(100)]);

  // **Schema Updates**
  const playerState = room.state.players.get(room.sessionId);
  if (playerState) {
    ammoText.text = `Ammo: ${playerState.gun.ammo} / ${playerState.gun.reserveAmmo}`;
    killText.text = `Kills: ${playerState.kills}`;

    $(playerState.gun).onChange(() => {
      ammoText.text = `Ammo: ${playerState.gun.ammo} / ${playerState.gun.reserveAmmo}`;
    });

    $(playerState).listen("kills", (value) => {
      killText.text = `Kills: ${value}`;
    });

    // **Aiming**
    k.onMouseMove(() => {
      const self = allPlayers.get(sessionId);
      if (!self) return;
      const worldMousePos = k.toWorld(k.mousePos());
      const angle = worldMousePos.sub(self.playerSprite.pos).angle();
      self.gunSprite.angle = angle;
      self.gunSprite.flipY = Math.abs(angle) > 90;
      const now = Date.now();
      if (now - lastAimSent > 100) {
        lastAimSent = now;
        room.send("aim", { playerId: sessionId, target: worldMousePos });
      }
    });

    // **Shooting (Auto-Fire)**
    let isFiring = false;
    let fireLoop: any = null;

    k.onMouseDown(() => {
      isFiring = true;
      const tryShoot = () => {
        const playerState = room.state.players.get(sessionId);
        if (!playerState) return;
        const gun = playerState.gun;
        if (!gun || gun.ammo <= 0 || gun.isReloading) return;
        const self = allPlayers.get(sessionId);
        if (!self) return;
        const worldMousePos = k.toWorld(k.mousePos());
        const dir = worldMousePos.sub(self.playerSprite.pos).unit();
        room.send("shoot", { dir: { x: dir.x, y: dir.y } });
      };
      tryShoot();
      fireLoop = setInterval(() => { if (isFiring) tryShoot(); }, playerState.gun.fireRate || 200);
    });

    k.onMouseRelease(() => {
      isFiring = false;
      if (fireLoop) clearInterval(fireLoop);
    });

    // **Reload**
    k.onKeyPress("r", () => room.send("reload"));

    // **Movement**
    k.onKeyDown("w", () => room.send("move", "up"));
    k.onKeyDown("s", () => room.send("move", "down"));
    k.onKeyDown("a", () => room.send("move", "left"));
    k.onKeyDown("d", () => room.send("move", "right"));
  }
}