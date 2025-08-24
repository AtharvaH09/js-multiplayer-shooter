import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player, Bullet } from "./schema/MyRoomState";
import { GAME_HEIGHT, GAME_WIDTH } from "../../../globals"
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';

import getCollisionRects from "./logic/Collision";
import extractSpawnPoints, { getFreeSpawnIndex, releaseSpawnIndex } from "./logic/Spawn";

// list of avatars
const avatars = ['red', 'blue', 'blonde'];
// list of maps
const maps = ['NP_test'];
// list of guns
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
  private lastShotTimes: Map<string, number> = new Map();


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

    // Shooting mechanism
    this.onMessage("shoot-ray", (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;

      const { origin, dir } = data;
      const range = 1024; // max distance for hits
      let closestPlayer: Player | null = null;
      let closestDist = range;

      this.broadcast("fired", { playerId: client.sessionId }, { except: client });  // Muzzle flash 

      for (const [id, player] of this.state.players) {
        if (id === client.sessionId) continue; // skip self
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
          }
        }
      }

      if (closestPlayer) {
        closestPlayer.health -= 20;
        if (closestPlayer.health <= 0) {
          console.log(`${closestPlayer.sessionId} is dead`);
        }
      }
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
