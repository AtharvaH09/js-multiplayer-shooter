import { Client } from "colyseus";
import { MyRoom } from "../MyRoom";
import { Player } from "../schema/MyRoomState";

/**
 * Handles reload request from the client.
 * Ensures the player is alive, not already reloading, and has reserve ammo.
 */
export function handleReload(room: MyRoom, client: Client) {
  const player = room.state.players.get(client.sessionId);
  if (!player || !player.isAlive) return;

  const gun = player.gun;
  if (!gun) return;

  // Validation
  if (gun.isReloading) return;
  if (gun.ammo >= gun.magSize) return; // magazine already full
  if (gun.reserveAmmo <= 0) return; // no reserve ammo

  // Start reload
  gun.isReloading = true;

  // Notify clients for reload animation
  room.broadcast("player-reload-start", {
    playerId: client.sessionId,
    reloadTime: gun.reloadTime
  });


  const reloadTime = gun.reloadTime || 2000; // 2 seconds reload time
  room.clock.setTimeout(() => {
    // Calculate ammo transfer
    const neededAmmo = gun.magSize - gun.ammo;
    const ammoToLoad = Math.min(neededAmmo, gun.reserveAmmo);

    gun.ammo += ammoToLoad;
    gun.reserveAmmo -= ammoToLoad;
    gun.isReloading = false;

    // Notify local client to stop spinner & update HUD
    // room.broadcast("player-reload-end", { playerId: client.sessionId }, { except: client });
    room.broadcast("player-reload-end", { playerId: client.sessionId });
  }, reloadTime);
}
