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

  if (room.state.gameState !== "in-progress") {
    client.send("action-rejected", { reason: "match-not-started" });
    return;
  }

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
  room.broadcast("player-fired", { playerId: client.sessionId });

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

  // Check players with proper AABB raycast
  for (const [id, p] of room.state.players) {
    if (id === shooterId || !p.isAlive) continue;

    // Build AABB around player
    const aabb = {
      x: p.x,
      y: p.y,
      w: 5, // same as player_width
      h: 5, // same as player_height
    };

    const invX = dir.x === 0 ? Number.POSITIVE_INFINITY : 1 / dir.x;
    const invY = dir.y === 0 ? Number.POSITIVE_INFINITY : 1 / dir.y;

    const tMinX = (aabb.x - origin.x) * invX;
    const tMaxX = ((aabb.x + aabb.w) - origin.x) * invX;
    const tMinY = (aabb.y - origin.y) * invY;
    const tMaxY = ((aabb.y + aabb.h) - origin.y) * invY;

    const tEnter = Math.max(Math.min(tMinX, tMaxX), Math.min(tMinY, tMaxY));
    const tExit = Math.min(Math.max(tMinX, tMaxX), Math.max(tMinY, tMaxY));

    if (tEnter < tExit && tEnter > 0 && tEnter < closestDist) {
      closestDist = tEnter;
      closestPlayer = p;
      hitPoint = { x: origin.x + dir.x * tEnter, y: origin.y + dir.y * tEnter };
      hitType = "player";
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
    const tExit = Math.min(Math.max(tMinX, tMaxX), Math.max(tMinY, tMaxY));

    if (tEnter < tExit && tEnter > 0 && tEnter < closestDist) {
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
      closestPlayer.deaths += 1;

      if (shooter && shooter.team !== closestPlayer.team) {
        shooter.kills += 1;
        if (shooter.team === "red") {
          room.state.redScore += 1;
        } else if (shooter.team === "blue") {
          room.state.blueScore += 1;
        }
      }

      if (room.state.redScore >= 40 || room.state.blueScore >= 40) {
        room._endRound();
      }

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
