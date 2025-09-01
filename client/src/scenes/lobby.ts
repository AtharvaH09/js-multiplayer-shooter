import { k } from "../App";
import { getStateCallbacks, Room } from "colyseus.js";
import type { MyRoomState, Player } from "../../../server/src/rooms/schema/MyRoomState";
import { GameObj } from "kaplay";

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
const opponentMuzzleFlash = new Map<string, { hasFired: boolean }>();

/**
 * Reference to the local player's sprite for camera tracking.
 */
let localPlayerSprite: GameObj | null = null;


/**
 * Scene: Lobby
 * Handles the map, player creation/removal, local input, and message subscriptions.
 */
export function createLobbyScene() {
  k.scene("lobby", (room: Room<MyRoomState>) => {
    const $ = getStateCallbacks(room);
    const spritesBySessionId: Record<string, GameObj> = {};

    // Load and display map
    room.send("request-map")

    room.onMessage("map-info", async (map_name) => {
      k.loadSprite("map", `assets/maps/${map_name}.png`);
      const map = k.add([k.sprite("map"), k.pos(0, 0), k.anchor("topleft"), k.z(-1)]);
    });

    /** Handle new player joining */
    $(room.state).players.onAdd((player, sessionId) => {
      const { playerSprite, gunSprite } = createPlayer(player);
      spritesBySessionId[sessionId] = playerSprite;
      allPlayers.set(sessionId, { playerSprite, gunSprite });

      if (sessionId === room.sessionId) {
        setupLocalPlayerAiming(sessionId, room);
      }
    });

    /** Handle remote aiming messages */
    room.onMessage("aim-taken", ({ playerId, target }) => {
      if (playerId === room.sessionId) return;
      const player = allPlayers.get(playerId);
      if (!player) return;

      const angle = k.vec2(target.x, target.y).sub(player.playerSprite.pos).angle();
      const data = opponentAimData.get(playerId);
      if (!data) {
        opponentAimData.set(playerId, {
          currentAngle: player.gunSprite.angle,
          targetAngle: angle,
        });
      } else {
        data.targetAngle = angle;
      }
    });

    /** Handle gun muzzle flashes */
    room.onMessage("fired", ({ playerId }) => {
      if (playerId === room.sessionId) return;
      const player = allPlayers.get(playerId);
      if (!player) return;

      const data = opponentMuzzleFlash.get(playerId);
      if (!data) {
        opponentMuzzleFlash.set(playerId, {
          hasFired: false,
        });
      } else {
        data.hasFired = true;
      }
    });

    /** Handle Hitmarker */
    k.loadSprite("hexagon", "assets/vfx/particle_hexagon_filledB.png");
    k.loadSprite("star", "assets/vfx/particle_star_filled.png");
    room.onMessage("hit-effect", ({ point, type, dir }) => {
      // Different colors for wall vs player
      const colorValue = type === "player" ? k.rgb(255, 0, 0) : k.rgb(140, 147, 176);
      const shotAngle = k.vec2(dir.x, dir.y).scale(-1).angle();  // flip by scaling inversely  

      const splatter = k.add([
        k.pos(point.x, point.y),
        k.particles({
          max: 20,
          speed: [200, 250],
          lifeTime: [0.2, 0.75],
          colors: [colorValue],
          opacities: [1.0, 0.0],
          angle: [0, 360],
          texture: k.getSprite("hexagon").data.tex,
          quads: [k.getSprite("hexagon").data.frames[0]],
        }, {
          lifetime: 0.75,
          rate: 0,
          direction: shotAngle,
          spread: 45,
        }),
      ]);

      splatter.emit(10);
      splatter.onEnd(() => {
        k.destroy(splatter);
      });
    });

    /** Handle Player Death */
    room.onMessage("player-dead", ({ playerId }) => {
      const player = allPlayers.get(playerId);
      if (!player) return;

      const ps = player.playerSprite;
      const gs = player.gunSprite ?? (ps as any).__gunSprite;
      const hb = (ps as any).__healthBar;

      // Create dissipate effect
      const rect = {
        pos: k.vec2(-16, -16), // offset to center particles
        width: 32,
        height: 32
      };

      rect.pos = rect.pos.sub(rect.width / 2, rect.height / 2);

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
      dissipate.onEnd(() => {
        k.destroy(dissipate);
      });

      // hide visuals (don't destroy — keep object for respawn)
      ps.opacity = 0;
      if (gs) gs.opacity = 0;
      if (hb) hb.opacity = 0;

      // stop animations and mark as dead
      try { ps.play && ps.play("idle-down"); } catch (e) { }
      player.isDead = true;
    });

    /** Handle player respawn */
    room.onMessage("player-respawned", ({ playerId, x, y, isInvincible }) => {
      const playerState = room.state.players.get(playerId); // authoritative schema
      let player = allPlayers.get(playerId);

      if (!player) {
        if (playerState) {
          const { playerSprite, gunSprite } = createPlayer(playerState);
          player = { playerSprite, gunSprite };
          allPlayers.set(playerId, player);
        }
      } else {
        player.playerSprite.pos.x = x;
        player.playerSprite.pos.y = y;
        player.playerSprite.opacity = 1;

        const ps = player.playerSprite;
        const gs = player.gunSprite ?? (ps as any).__gunSprite;
        const hb = (ps as any).__healthBar;

        if (gs) gs.opacity = 1;
        if (hb) hb.opacity = 1;
        player.isDead = false;
      }

      if (isInvincible) {
        const shield = player.playerSprite.add([
          k.circle(28),
          k.color(0, 255, 255),
          k.opacity(0.35),
          k.anchor("center"),
          k.z(22),
        ]);

        k.wait(3, () => { if (shield) k.destroy(shield); });
      }
    });

    /** Handle player leaving */
    $(room.state).players.onRemove((_, sessionId) => {
      k.destroy(spritesBySessionId[sessionId]);
      delete spritesBySessionId[sessionId];
      allPlayers.delete(sessionId);
    });

    /** Movement input bindings */
    k.onKeyDown("w", () => sendMove("up"));
    k.onKeyDown("s", () => sendMove("down"));
    k.onKeyDown("a", () => sendMove("left"));
    k.onKeyDown("d", () => sendMove("right"));

    /** Sends a move command to the server */
    function sendMove(dir: string) {
      const self = room.state.players.get(room.sessionId);
      if (!self) return;
      room.send("move", dir);
    }
  });

}

/**
 * Creates a new player sprite and associated gun.
 * Also sets up interpolation, animation switching, and camera tracking.
 */
function createPlayer(player: Player) {
  k.loadSprite("gun", `assets/gun.png`);

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

    // Muzzle Flash Synchronization
    for (const [playerId, data] of opponentMuzzleFlash) {
      const opponent = allPlayers.get(playerId);
      if (!opponent) continue;

      if (data.hasFired) {
        const flash = opponent.gunSprite.add([
          k.pos(opponent.gunSprite.width * 1.5, Math.abs(opponent.gunSprite.angle) > 90 ? 7 : -7),
          k.circle(10),
          k.color(255, 255, 0),
          k.opacity(0.5),
        ]);
        flash.fadeOut(0.2).then(() => k.destroy(flash));
        data.hasFired = false;
      }

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
function setupLocalPlayerAiming(sessionId: string, room: Room<MyRoomState>) {
  localPlayerSprite = allPlayers.get(sessionId)?.playerSprite ?? null;
  let lastAimSent = 0;
  let lastShotTime = 0;

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

  k.onMousePress(() => {
    // Visual muzzle flash
    const self = allPlayers.get(room.sessionId);
    if (!self) return;

    const flash = self.gunSprite.add([
      k.pos(self.gunSprite.width * 2, Math.abs(self.gunSprite.angle) > 90 ? 7 : -7),
      k.circle(10),
      k.color(255, 255, 0),
      k.opacity(0.5),
    ]);
    flash.fadeOut(0.2).then(() => k.destroy(flash));

    // Ray direction
    const worldMousePos = k.toWorld(k.mousePos());
    const dir = worldMousePos.sub(self.playerSprite.pos).unit();

    // Send to server
    room.send("shoot-ray", {
      origin: { x: self.playerSprite.pos.x, y: self.playerSprite.pos.y },
      dir: { x: dir.x, y: dir.y }
    });
  });
}