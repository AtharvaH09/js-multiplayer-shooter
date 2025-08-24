import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player } from "./schema/MyRoomState";
import { GAME_HEIGHT, GAME_WIDTH } from "../../../globals"
import fs from "fs";
import path from "path";

import getCollisionRects from "./logic/Collision";
import extractSpawnPoints, { getFreeSpawnIndex, releaseSpawnIndex } from "./logic/Spawn";

/**  list of avatars */
const avatars = ['red', 'blue', 'blonde'];
/** list of maps */
const maps = ['NP_test'];
/** list of guns  */
const guns = ['pistol_test'];

const player_width = 5;
const player_height = 5;

type Collider = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type SpawnPoint = {
  x: number;
  y: number;
  team: "red" | "blue";
  occupied?: boolean;
};

function getMapData(mapName: string) {
  const filePath = path.join(__dirname, `../assets/maps/${mapName}.json`);
  const rawData = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(rawData);
}

export class MyRoom extends Room {
  maxClients = 10;
  state = new MyRoomState();
  private mapData: any;
  private colliders: Collider[] = [];
  private spawns: SpawnPoint[] = [];

  teamPlayersCount(team: "blue" | "red" = "blue") {
    return [...this.state.players.values()].filter(p => p.team === team).length;
  }

  onCreate(options: any) {
    this.mapData = getMapData(maps[0]);
    this.colliders = getCollisionRects(this.mapData);
    this.spawns = extractSpawnPoints(this.mapData);

    this.onMessage("request-map", (client) => {
      client.send("map-info", this.mapData.mapname)
    })

    // Player Collision
    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const speed = 0.8;
      const newX = player.x + message.dx * speed;
      const newY = player.y + message.dy * speed;

      const isColliding = this.colliders.some(c => (
        newX < c.x + c.w &&
        newX + player_width > c.x &&
        newY < c.y + c.h &&
        newY + player_height > c.y
      ));

      if (!isColliding) {
        player.x = newX;
        player.y = newY;
      }
    });

    // Gun aiming - visual feature synchronization 
    this.onMessage("aim", (client, message) => {
      this.broadcast("aim-taken", message, { except: client })
    });

    /** Shooting mechanism */
    this.onMessage("shoot-ray", (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;

      const { origin, dir } = data;
      const range = 1024; // max distance for hits
      let closestPlayer: Player | null = null;
      let closestDist = range;

      let hitPoint = { x: origin.x + dir.x * range, y: origin.y + dir.y * range };
      let hitType: "none" | "player" | "wall" = "none";

      this.broadcast("fired", { playerId: client.sessionId }, { except: client });  // Muzzle flash 

      // Check players
      for (const [id, player] of this.state.players) {
        if (id === client.sessionId) continue;  // skip self
        const toTarget = { x: player.x - origin.x, y: player.y - origin.y };

        // Project vector length along dir (dot product)
        const projLength = toTarget.x * dir.x + toTarget.y * dir.y;
        if (projLength < 0 || projLength > range) continue; // behind or too far

        // Distance from ray
        const perpDist = Math.abs(toTarget.x * dir.y - toTarget.y * dir.x);
        if (perpDist < 20) { // hit threshold
          const distance = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2);
          if (distance < closestDist) {
            closestDist = distance;
            closestPlayer = player;
            hitPoint = { x: origin.x + dir.x * projLength, y: origin.y + dir.y * projLength };
            hitType = "player";
          }
        }
      }

      // Check colliders (Walls)
      for (const c of this.colliders) {
        const tMinX = (c.x - origin.x) / dir.x;
        const tMaxX = ((c.x + c.w) - origin.x) / dir.x;
        const tMinY = (c.y - origin.y) / dir.y;
        const tMaxY = ((c.y + c.h) - origin.y) / dir.y;

        const tEnter = Math.max(Math.min(tMinX, tMaxX), Math.min(tMinY, tMaxY));
        if (tEnter > 0 && tEnter < closestDist) {
          closestDist = tEnter;
          hitPoint = { x: origin.x + dir.x * tEnter, y: origin.y + dir.y * tEnter }
          hitType = "wall";
        }
      }

      // Apply damage if the player was hit
      if (closestPlayer) {
        closestPlayer.health -= 20;
        if (closestPlayer.health <= 0) {
          console.log(`${closestPlayer.sessionId} is dead`);
        }
      }

      // Broadcast hit position
      this.broadcast("hit-effect", {
        playerId: client.sessionId,
        point: hitPoint,
        type: hitType,
        dir: { x: dir.x, y: dir.y }
      });
    });
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const redCount = this.teamPlayersCount("red");
    const blueCount = this.teamPlayersCount("blue");

    const team = blueCount <= redCount ? "blue" : "red";
    const spawnIdx = getFreeSpawnIndex(this.spawns, team);

    if (spawnIdx === -1) {
      console.log("No free spawn points available!");
      client.leave(4000, "no-spawn");
      return;
    }

    const spawn = this.spawns[spawnIdx];

    const player = new Player();
    player.team = team;
    player.x = spawn.x;
    player.y = spawn.y;
    player.sessionId = client.sessionId;
    player.avatar = avatars[Math.floor(Math.random() * avatars.length)];

    this.state.players.set(client.sessionId, player);
    player.spawn = spawnIdx; // keep reference so we can free it later

  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    const player = this.state.players.get(client.sessionId);

    if (player && typeof player.spawn === "number") {
      releaseSpawnIndex(this.spawns, player.spawn);
    }

    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
