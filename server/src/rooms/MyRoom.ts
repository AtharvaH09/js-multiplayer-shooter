import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player, Gun } from "./schema/MyRoomState";
import { GAME_HEIGHT, GAME_WIDTH } from "../../../globals"
import fs from "fs";
import path from "path";

import getCollisionRects from "./logic/Collision";
import { extractSpawnPoints, getFreeSpawnIndex, releaseSpawnIndex, getSafeSpawnIndex } from "./logic/Spawn";
import { handleShoot } from "./logic/Shooting";
import { handleReload } from "./logic/Reloading";

// Round duration (in seconds)
const ROUND_DURATION = 300; // 5 minutes
let timeLeft = ROUND_DURATION;

/**  list of avatars */
const avatars = ['red', 'blue', 'blonde'];
/** list of maps */
// const maps = ['NP_test'];
const maps = ['Nexon_Prime_beta'];
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

export class MyRoom extends Room {
  maxClients = 10;
  state = new MyRoomState();

  mapData: any;
  colliders: Collider[] = [];
  spawns: SpawnPoint[] = [];
  lastShotTimes: Map<string, number> = new Map();

  private countdownIntervalRef?: NodeJS.Timeout | number;
  private roundIntervalRef?: NodeJS.Timeout | number;

  teamPlayersCount(team: "blue" | "red" = "blue") {
    return [...this.state.players.values()].filter(p => p.team === team).length;
  }

  onCreate(options: any) {
    this.state.gameState = "waiting";
    this.state.countdown = 0;
    this.state.roundTime = 0;
    this.state.roundDuration = 300; // 5 minutes
    this.state.startCountdown = 60; // 60 seconds pre-start (when min players met)
    this.state.minPlayersPerTeam = 1;

    this.mapData = this.getMapData(maps[0]);
    this.colliders = getCollisionRects(this.mapData);
    this.spawns = extractSpawnPoints(this.mapData);

    this.onMessage("request-map", (client) => {
      client.send("map-info", this.mapData.mapname)
    })

    // Player Collision
    this.onMessage("move", (client, dir) => {
      const player = this.state.players.get(client.sessionId);
      let dx, dy;
      if (!player) return;

      switch (dir) {
        case "up": dx = 0; dy = -1; break;
        case "down": dx = 0; dy = 1; break;
        case "left": dx = -1; dy = 0; break;
        case "right": dx = 1; dy = 0; break;
      }
      const speed = 0.8;
      const newX = player.x + dx * speed;
      const newY = player.y + dy * speed;

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

    this.onMessage("shoot", (client, data) => handleShoot(this, client, data));
    this.onMessage("reload", (client) => handleReload(this, client));

  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    this._onPlayersChanged();


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

    this._onPlayersChanged();

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

    this._onPlayersChanged();
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  /**--------------------------------
   * Helper / Game State logic
   * --------------------------------
   */

  private getMapData(mapName: string) {
    const filePath = path.join(__dirname, `../assets/maps/${mapName}.json`);
    const rawData = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(rawData);
  }

  /** Called whenever players join/leave to re-evaluate waiting/countdown */
  private _onPlayersChanged() {

    // if a match is already running or ended, do nothing
    if (this.state.gameState === "in-progress" || this.state.gameState === "ended") return;

    // Count players per team
    const redCount = [...this.state.players.values()].filter(p => p.team === "red").length;
    const blueCount = [...this.state.players.values()].filter(p => p.team === "blue").length;

    // If both teams have at least minPlayersPerTeam, start countdown (if not already)
    if (redCount >= this.state.minPlayersPerTeam && blueCount >= this.state.minPlayersPerTeam) {
      if (this.state.gameState !== "countdown") {
        this._startCountdown(this.state.startCountdown);
      }
    } else {
      // Not enough players — ensure we're in waiting
      if (this.state.gameState !== "waiting") {
        this._setWaiting();
      }
    }
  }

  private _setWaiting() {
    // clear any running countdown
    if (this.countdownIntervalRef) { clearInterval(this.countdownIntervalRef); this.countdownIntervalRef = undefined; }
    this.state.gameState = "waiting";
    this.state.countdown = 0;
    this.broadcast("game-state-changed", { state: this.state.gameState });
  }

  private _startCountdown(seconds: number) {
    // If already counting, ignore
    if (this.state.gameState === "countdown") return;

    // clear any prior timers
    if (this.countdownIntervalRef) clearInterval(this.countdownIntervalRef as any);

    this.state.gameState = "countdown";
    this.state.countdown = seconds;
    this.broadcast("game-state-changed", { state: this.state.gameState, countdown: this.state.countdown });

    this.countdownIntervalRef = setInterval(() => {
      // If teams drop below minPlayersPerTeam, abort
      const redCount = [...this.state.players.values()].filter(p => p.team === "red").length;
      const blueCount = [...this.state.players.values()].filter(p => p.team === "blue").length;
      if (redCount < this.state.minPlayersPerTeam || blueCount < this.state.minPlayersPerTeam) {
        clearInterval(this.countdownIntervalRef as any);
        this.countdownIntervalRef = undefined;
        this._setWaiting();
        return;
      }

      this.state.countdown -= 1;
      this.broadcast("game-state-changed", { state: this.state.gameState, countdown: this.state.countdown });

      if (this.state.countdown <= 0) {
        clearInterval(this.countdownIntervalRef as any);
        this.countdownIntervalRef = undefined;
        this._beginRound();
      }
    }, 1000);
  }

  private _beginRound() {
    // start the match
    this.state.gameState = "in-progress";
    this.state.roundTime = this.state.roundDuration;
    this.state.redScore = 0;
    this.state.blueScore = 0;

    this.broadcast("game-state-changed", {
      state: this.state.gameState,
      roundTime: this.state.roundTime,
      redScore: this.state.redScore,
      blueScore: this.state.blueScore
    });

    // per-second round timer
    if (this.roundIntervalRef) clearInterval(this.roundIntervalRef as any);
    this.roundIntervalRef = setInterval(() => {
      // if round not in progress (defensive), bail
      if (this.state.gameState !== "in-progress") {
        clearInterval(this.roundIntervalRef as any);
        this.roundIntervalRef = undefined;
        return;
      }

      this.state.roundTime -= 1;
      this.broadcast("game-state-changed", { state: this.state.gameState, roundTime: this.state.roundTime });

      if (this.state.roundTime <= 0) {
        clearInterval(this.roundIntervalRef as any);
        this.roundIntervalRef = undefined;
        this._endRound();
      }
    }, 1000);
  }

  public _endRound() {
    this.state.gameState = "ended";
    this.broadcast("round-ended", {
      redScore: this.state.redScore,
      blueScore: this.state.blueScore,
      winner: this.state.redScore > this.state.blueScore ? "Red" :
        this.state.blueScore > this.state.redScore ? "Blue" : "Draw"
    });

    // cleanup intervals
    if (this.countdownIntervalRef) { clearInterval(this.countdownIntervalRef); this.countdownIntervalRef = undefined; }
    if (this.roundIntervalRef) { clearInterval(this.roundIntervalRef); this.roundIntervalRef = undefined; }

    // TODO: either reset state after some time or disconnect clients / rotate map
    // For now we reset to waiting after a short pause so clients can see results
    this.clock.setTimeout(() => {
      // reset scores and players stats for next match
      for (const p of this.state.players.values()) {
        p.kills = 0;
        p.deaths = 0;
        p.health = p.maxHealth;
        p.isAlive = true;
        p.isInvincible = false;
      }
      this.state.redScore = 0;
      this.state.blueScore = 0;
      this._setWaiting();
    }, 8000);
  }
}