import { k } from '../App';
import { Room } from 'colyseus.js';
import { MyRoomState } from '../../../server/src/rooms/schema/MyRoomState';
import { GameObj } from "kaplay";

let overlayUI: GameObj | null = null;
let overlayVisible = false;

/** Function to create and show the overlay */
export function showGameOptionsOverlay(room: Room<MyRoomState>) {
  if (overlayUI) return; // Already open

  // Fullscreen semi-transparent background
  overlayUI = k.add([
    k.rect(k.width(), k.height()),
    k.color(0, 0, 0),
    k.opacity(0.6),
    k.z(999),
    k.fixed(),
  ]);

  // Container for table and buttons
  const container = overlayUI.add([
    k.pos(k.width() / 2, k.height() / 2),
    k.anchor("center"),
  ]);

  // Title
  container.add([
    k.text("Match Details", { size: 28 }),
    k.color(255, 255, 255),
    k.pos(0, -200),
    k.anchor("center"),
  ]);

  // Objective & Scores
  const scoresText = container.add([
    k.text(`Blue: ${room.state.blueScore} | Red: ${room.state.redScore} (40 to win)`, { size: 20 }),
    k.color(255, 255, 255),
    k.pos(0, -160),
    k.anchor("center"),
  ]);

  // Quit Button
  const quitButton = container.add([
    k.rect(120, 40),
    k.color(255, 0, 0),
    k.pos(200, -200),
    k.anchor("center"),
    k.z(1000),
    k.area(),
  ]);

  quitButton.add([
    k.text("Quit", { size: 16 }),
    k.color(255, 255, 255),
    k.anchor("center"),
    k.pos(0, 0),
  ]);

  quitButton.onClick(() => {
    room.leave();
    k.go("main-menu"); // Or redirect to menu scene
  });

  /** Generate Player Table */
  const tableYStart = -100;
  const rowHeight = 30;

  // Table Headers
  container.add([
    k.text("Red Team", { size: 18 }),
    k.color(255, 50, 50),
    k.pos(100, tableYStart - 40),
  ]);
  container.add([
    k.text("Blue Team", { size: 18 }),
    k.color(50, 50, 255),
    k.pos(-200, tableYStart - 40),
  ]);

  // Dynamic rows
  const updateTable = () => {
    // Remove old rows if they exist
    container.children
      .filter(c => (c as any).__isRow)
      .forEach(c => k.destroy(c));

    const bluePlayers = [...room.state.players.values()].filter(p => p.team === "blue");
    const redPlayers = [...room.state.players.values()].filter(p => p.team === "red");

    const maxRows = Math.max(redPlayers.length, bluePlayers.length);

    for (let i = 0; i < maxRows; i++) {
      const y = tableYStart + i * rowHeight;

      if (bluePlayers[i]) {
        const p = bluePlayers[i];
        const row = container.add([
          k.text(`${p.name ?? `Guest-${p.sessionId}`} | K:${p.kills} D:${p.deaths}`, { size: 16 }),
          k.color(255, 255, 255),
          k.pos(-200, y),
        ]);
        (row as any).__isRow = true;
      }

      if (redPlayers[i]) {
        const p = redPlayers[i];
        const row = container.add([
          k.text(`${p.name ?? `Guest-${p.sessionId}`} | K:${p.kills} D:${p.deaths}`, { size: 16 }),
          k.color(255, 255, 255),
          k.pos(100, y),
        ]);
        (row as any).__isRow = true;
      }
    }

    scoresText.text = `Blue: ${room.state.blueScore} | Red: ${room.state.redScore} (40 to win)`;
  };

  // Update every second for real-time stats
  const interval = setInterval(updateTable, 1000);
  updateTable();

  overlayUI.onDestroy(() => clearInterval(interval));
}

/** Function to hide overlay */
export function hideGameOptionsOverlay() {
  if (overlayUI) {
    k.destroy(overlayUI);
    overlayUI = null;
  }
}
