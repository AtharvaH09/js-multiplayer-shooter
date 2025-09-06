import { MyRoom } from "../MyRoom";
import { Player } from "../schema/MyRoomState";
import { getSafeSpawnIndex } from "./Spawn";

/**
 * Handles player respawn logic.
 * Respawns the given player after a delay, restores health, and applies temporary invincibility.
 */
export function handleRespawn(room: MyRoom, player: Player) {
  // Mark player as dead to prevent other actions
  player.isAlive = false;

  // Respawn after 3 seconds
  room.clock.setTimeout(() => {
    // Find a safe spawn point for the player's team
    const spawnIdx = getSafeSpawnIndex(room.spawns, player.team, room.state.players.values());
    const spawn = room.spawns[spawnIdx];

    // Reset player state
    player.x = spawn.x;
    player.y = spawn.y;
    player.health = player.maxHealth;
    player.isAlive = true;
    player.isInvincible = true;
    player.gun.ammo = player.gun.magSize;
    player.gun.reserveAmmo = player.gun.maxReserveAmmo;

    // Notify all clients
    room.broadcast("player-respawned", {
      playerId: player.sessionId,
      x: spawn.x,
      y: spawn.y,
      isInvincible: true, // explicitly send this info
    });

    // Remove invincibility after 3 seconds
    room.clock.setTimeout(() => {
      player.isInvincible = false;
    }, 3000);
  }, 3000);
}
