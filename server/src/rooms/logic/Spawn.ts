export type SpawnPoint = {
  x: number;
  y: number;
  team: "red" | "blue";
  occupied?: boolean;
};

export default function extractSpawnPoints(mapData: any): SpawnPoint[] {
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

/** Return index of a free spawn for team, or -1 if none. Marks it occupied. */
export function getFreeSpawnIndex(spawns: SpawnPoint[], team: "red" | "blue"): number {
  const candidates = spawns
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.team === team && !s.occupied);

  if (candidates.length === 0) return -1;

  const { i } = candidates[Math.floor(Math.random() * candidates.length)];
  spawns[i].occupied = true;
  return i;
}

/** Release a spawn by index. */
export function releaseSpawnIndex(spawns: SpawnPoint[], index: number): void {
  if (index >= 0 && index < spawns.length) spawns[index].occupied = false;
}
