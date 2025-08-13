import { k } from "../App";
import { getStateCallbacks, Room } from "colyseus.js";
import type { MyRoomState, Player } from "../../../server/src/rooms/schema/MyRoomState";
import { GameObj } from "kaplay";

const allPlayers = new Map<string, {
  playerSprite: GameObj,
  gunSprite: GameObj,
}>();

const opponentAimData = new Map<string, {
  currentAngle: number,
  targetAngle: number
}>();

let localPlayerSprite: GameObj | null = null;

export function createLobbyScene() {
  k.scene("lobby", (room: Room<MyRoomState>) => {
    const $ = getStateCallbacks(room);
    const spritesBySessionId: Record<string, GameObj> = {};

    k.loadSprite("map", `assets/maps/Nexon_Prime_sector1.png`)
    const mapSprite = k.add([
      k.sprite("map"),
      k.pos(0, 0),
      k.anchor("center"),
    ]);

    // Handle player addition
    $(room.state).players.onAdd((player, sessionId) => {
      const { playerSprite, gunSprite } = createPlayer(player);
      spritesBySessionId[sessionId] = playerSprite;
      allPlayers.set(sessionId, { playerSprite, gunSprite });

      // Local player aiming
      if (sessionId === room.sessionId) {
        localPlayerSprite = playerSprite;
        let lastAimSent = 0;
        k.onMouseMove(() => {
          const self = allPlayers.get(sessionId);
          if (!self) return;
          const worldMousePos = k.toWorld(k.mousePos());

          const targetPos = k.mousePos();
          const angle = worldMousePos.sub(self.playerSprite.pos).angle();
          self.gunSprite.angle = angle;
          self.gunSprite.flipY = Math.abs(angle) > 90;

          const now = Date.now();
          if (now - lastAimSent > 100) {
            room.send("aim", {
              playerId: sessionId,
              target: worldMousePos,
            });
          }

        });
      }
    });

    // Remote aiming
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

    // Handle player removal
    $(room.state).players.onRemove((_, sessionId) => {
      k.destroy(spritesBySessionId[sessionId]);
      delete spritesBySessionId[sessionId];
      allPlayers.delete(sessionId);
    });

    // Movement keys
    k.onKeyDown("w", () => sendMove(0, -1));
    k.onKeyDown("s", () => sendMove(0, 1));
    k.onKeyDown("a", () => sendMove(-1, 0));
    k.onKeyDown("d", () => sendMove(1, 0));

    function sendMove(dx: number, dy: number) {
      const self = room.state.players.get(room.sessionId);
      if (!self) return;
      room.send("move", { dx, dy });
    }
  });
}


// Create player sprite and gun
function createPlayer(player: Player) {
  // k.loadSprite(player.avatar, `assets/${player.avatar}.png`);
  k.loadSprite("gun", `assets/gun.png`);

  // Store avatar offsets in rows
  const avatarOffsets: Record<string, number> = {
    red: 0,
    blue: 9,
    blonde: 18,
  };

  // Store frame counts for animations
  // function getAnimFrames(rowStart: number) {
  //   return {
  //     idle: { from: rowStart * 3, to: rowStart * 3 + 2, speed: 5, loop: true },
  //     walk: { from: (rowStart + 1) * 3, to: (rowStart + 1) * 3 + 2, speed: 10, loop: true },
  //   };
  // }

  // In createPlayer
  const rowStart = avatarOffsets[player.avatar] ?? 0; // default to red if not found

  // Load the full sheet ONCE at start
  k.loadSprite("all_avatars", "assets/player/neo_zero_char_01.png", {
    sliceX: 3,
    sliceY: 9,
    anims: {
      "idle": rowStart + 1,
      "walk": { from: (rowStart + 1) * 3, to: (rowStart + 1) * 3 + 2, speed: 10, loop: true },
    }
  });

  const playerSprite = k.add([
    k.sprite("all_avatars", { anim: "idle" }),
    k.pos(player.x, player.y),
    k.anchor("center"),
  ]);

  playerSprite.play("idle");

  const gunSprite = playerSprite.add([
    k.sprite("gun"),
    k.anchor(k.vec2(-1.8, 0)),
    k.scale(0.5),
    k.rotate(0),
  ]);

  k.onUpdate(() => {
    if (localPlayerSprite) {
      k.setCamPos(localPlayerSprite.worldPos());
      k.setCamScale(3);
    }
  });

  // Interpolations

  k.onUpdate(() => {
    for (const [playerId, data] of opponentAimData) {
      const player = allPlayers.get(playerId);

      if (!player) continue;

      data.currentAngle = k.lerp(data.currentAngle, data.targetAngle, 2 * k.dt());
      player.gunSprite.angle = data.currentAngle;
      player.gunSprite.flipY = Math.abs(data.currentAngle) > 90;
    }

    playerSprite.pos.x = k.lerp(playerSprite.pos.x, player.x, 12 * k.dt());
    playerSprite.pos.y = k.lerp(playerSprite.pos.y, player.y, 12 * k.dt());
  });

  let camPos = k.vec2(0, 0);

  k.onUpdate(() => {
    if (localPlayerSprite) {
      camPos.x = k.lerp(camPos.x, localPlayerSprite.pos.x, 8 * k.dt());
      camPos.y = k.lerp(camPos.y, localPlayerSprite.pos.y, 8 * k.dt());
      k.setCamPos(camPos);
    }
  });

  return { playerSprite, gunSprite };
}
