import { Client } from "colyseus";
import { MyRoom } from "../MyRoom";
import { Player } from "../schema/MyRoomState";
import { handleRespawn } from "./Respawn";

/**
 * Handles shooting logic.
 * Validates ammo, fire rate, and applies damage with simple raycasting.
 */
export function handleShoot(
  room: MyRoom,
  client: Client,
  data: { dir: { x: number; y: number } }
) {
  const shooter = room.state.players.get(client.sessionId);
  if (!shooter || !shooter.isAlive) return;

  const gun = shooter.gun;
  if (!gun) return;

  // Fire rate validation (simple approach)
  const now = Date.now();
  if (!room.lastShotTimes) { room.lastShotTimes = new Map<string, number>() };
  const lastShot = room.lastShotTimes.get(client.sessionId) || 0;

  const fireDelay = gun.fireRate || 200; // default 200ms if not set
  if (now - lastShot < fireDelay) return; // too soon

  if (gun.isReloading || gun.ammo <= 0) return;

  // Update state
  gun.ammo -= 1;
  room.lastShotTimes.set(client.sessionId, now);

  // Broadcast muzzle flash to others
  room.broadcast("fired", { playerId: client.sessionId }, { except: client });

  // Perform raycast for hit detection
  doRaycast(room, client.sessionId, shooter, data.dir);
}

/**
 * Raycast for bullet hit detection.
 */
function doRaycast(room: MyRoom, shooterId: string, shooter: Player, dir: { x: number; y: number }) {
  const origin = { x: shooter.x, y: shooter.y };
  const range = 1024;
  let closestPlayer: Player | null = null;
  let closestDist = range;
  let hitPoint = { x: origin.x + dir.x * range, y: origin.y + dir.y * range };
  let hitType: "none" | "player" | "wall" = "none";

  // Check players
  for (const [id, p] of room.state.players) {
    if (id === shooterId || !p.isAlive) continue;

    const toTarget = { x: p.x - origin.x, y: p.y - origin.y };
    const proj = toTarget.x * dir.x + toTarget.y * dir.y;
    if (proj < 0 || proj > range) continue;

    const perp = Math.abs(toTarget.x * dir.y - toTarget.y * dir.x);
    if (perp < 20) {
      const dist = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = p;
        hitPoint = { x: origin.x + dir.x * proj, y: origin.y + dir.y * proj };
        hitType = "player";
      }
    }
  }

  // Check walls (if room.colliders exist)
  for (const c of room.colliders) {
    const invX = dir.x === 0 ? Number.POSITIVE_INFINITY : 1 / dir.x;
    const invY = dir.y === 0 ? Number.POSITIVE_INFINITY : 1 / dir.y;

    const tMinX = (c.x - origin.x) * invX;
    const tMaxX = ((c.x + c.w) - origin.x) * invX;
    const tMinY = (c.y - origin.y) * invY;
    const tMaxY = ((c.y + c.h) - origin.y) * invY;

    const tEnter = Math.max(Math.min(tMinX, tMaxX), Math.min(tMinY, tMaxY));
    if (tEnter > 0 && tEnter < closestDist) {
      closestDist = tEnter;
      hitPoint = { x: origin.x + dir.x * tEnter, y: origin.y + dir.y * tEnter };
      hitType = "wall";
    }
  }

  // Apply damage
  if (closestPlayer && closestPlayer.isAlive && !closestPlayer.isInvincible) {
    closestPlayer.health -= 20;
    if (closestPlayer.health <= 0) {
      closestPlayer.isAlive = false;
      room.broadcast("player-dead", { playerId: closestPlayer.sessionId });
      handleRespawn(room, closestPlayer);
    }
  }

  // Send hit effect to everyone
  room.broadcast("hit-effect", {
    playerId: shooterId,
    point: hitPoint,
    type: hitType,
    dir: { x: dir.x, y: dir.y }
  });
}
