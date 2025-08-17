import { k } from "../App";
import { getStateCallbacks, Room } from "colyseus.js";
import type { MyRoomState, Player } from "../../../server/src/rooms/schema/MyRoomState";
import { GameObj } from "kaplay";
import { map, Vec2, vec2 } from "kaplay/dist/declaration/math";

/**
 * Stores all active players keyed by their session ID.
 * Each entry holds both the player sprite and the gun sprite.
 */
const allPlayers = new Map<string, { playerSprite: GameObj; gunSprite: GameObj }>();

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

    /** Handle player leaving */
    $(room.state).players.onRemove((_, sessionId) => {
      k.destroy(spritesBySessionId[sessionId]);
      delete spritesBySessionId[sessionId];
      allPlayers.delete(sessionId);
    });

    /** Movement input bindings */
    k.onKeyDown("w", () => sendMove(0, -1));
    k.onKeyDown("s", () => sendMove(0, 1));
    k.onKeyDown("a", () => sendMove(-1, 0));
    k.onKeyDown("d", () => sendMove(1, 0));

    /** Sends a move command to the server */
    function sendMove(dx: number, dy: number) {
      const self = room.state.players.get(room.sessionId);
      if (!self) return;
      room.send("move", { dx, dy });
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
    // k.area(),
    k.scale(0.8),
    k.z(10),
  ]);

  const gunSprite = playerSprite.add([
    k.sprite("gun"),
    k.anchor(k.vec2(-1.8, 0)),
    k.scale(0.5),
    k.rotate(0),
  ]);

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
}