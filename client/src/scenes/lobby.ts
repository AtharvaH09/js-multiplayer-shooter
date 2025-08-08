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

export function createLobbyScene() {
  k.scene("lobby", (room: Room<MyRoomState>) => {
    const $ = getStateCallbacks(room);
    const spritesBySessionId: Record<string, GameObj> = {};

    // Handle player addition
    $(room.state).players.onAdd((player, sessionId) => {
      const { playerSprite, gunSprite } = createPlayer(player);
      spritesBySessionId[sessionId] = playerSprite;
      allPlayers.set(sessionId, { playerSprite, gunSprite });

      // Local player aiming
      if (sessionId === room.sessionId) {
        let lastAimSent = 0;
        k.onMouseMove(() => {
          const self = allPlayers.get(sessionId);
          if (!self) return;

          const targetPos = k.mousePos();
          const angle = targetPos.sub(self.playerSprite.pos).angle();
          self.gunSprite.angle = angle;
          self.gunSprite.flipY = Math.abs(angle) > 90;

          const now = Date.now();
          if (now - lastAimSent > 100) {
            room.send("aim", {
              playerId: sessionId,
              target: targetPos,
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
  k.loadSprite(player.avatar, `assets/${player.avatar}.png`);
  k.loadSprite("gun", `assets/gun.png`);

  const playerSprite = k.add([
    k.sprite(player.avatar),
    k.pos(player.x, player.y),
    k.anchor("center"),
  ]);

  const gunSprite = playerSprite.add([
    k.sprite("gun"),
    k.anchor(k.vec2(-2, 0)),
    k.rotate(0),
  ]);


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

  return { playerSprite, gunSprite };
}
