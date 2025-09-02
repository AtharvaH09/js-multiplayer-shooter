export interface SpawnPoint {
  x: number;
  y: number;
  team: "blue" | "red";
  occupied?: boolean;
}

/**
 * Extracts spawn points from the Tiled map data.
 */
export function extractSpawnPoints(mapData: any): SpawnPoint[] {
  const spawns: SpawnPoint[] = [];
  const positionsLayer = mapData.layers.find((l: any) => l.name === "Positions");
  if (!positionsLayer) return spawns;

  for (const obj of positionsLayer.objects) {
    if (obj.type === "SpawnPoint") {
      if (obj.name.startsWith("spawn_red")) {
        spawns.push({ x: obj.x, y: obj.y, team: "red", occupied: false });
      } else if (obj.name.startsWith("spawn_blue")) {
        spawns.push({ x: obj.x, y: obj.y, team: "blue", occupied: false });
      }
    }
  }
  return spawns;
}

/**
 * Returns a random free spawn for a given team.
 * Marks it as occupied. Returns -1 if none available.
 */
export function getFreeSpawnIndex(spawns: SpawnPoint[], team: "red" | "blue"): number {
  const candidates = spawns
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.team === team && !s.occupied);

  if (candidates.length === 0) return -1;

  const { i } = candidates[Math.floor(Math.random() * candidates.length)];
  spawns[i].occupied = true;
  return i;
}

/**
 * Releases a spawn index (makes it available again).
 */
export function releaseSpawnIndex(spawns: SpawnPoint[], index: number): void {
  if (index >= 0 && index < spawns.length) spawns[index].occupied = false;
}

/**
 * Returns the safest spawn for a team (farthest from enemies).
 */
export function getSafeSpawnIndex(spawns: SpawnPoint[], team: "blue" | "red", players: Iterable<any>): number {
  const teamSpawns = spawns
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.team === team);

  let bestSpawnIdx = teamSpawns[0]?.i ?? 0;
  let maxDist = -Infinity;

  for (const { s, i } of teamSpawns) {
    let minEnemyDist = Infinity;

    for (const player of players) {
      if (player.team !== team && player.isAlive) {
        const dx = player.x - s.x;
        const dy = player.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minEnemyDist) {
          minEnemyDist = dist;
        }
      }
    }

    if (minEnemyDist > maxDist) {
      maxDist = minEnemyDist;
      bestSpawnIdx = i;
    }
  }

  spawns[bestSpawnIdx].occupied = true;
  return bestSpawnIdx;
}