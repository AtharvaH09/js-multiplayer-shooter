import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player } from "./schema/MyRoomState";
import { GAME_HEIGHT, GAME_WIDTH } from "../../../globals"

// list of avatars
// const avatars = ['glady', 'dino', 'bean', 'bag', 'btfly', 'bobo', 'ghostiny', 'ghosty', 'mark'];
const avatars = ['red', 'blue', 'blonde'];
const maps = ['Nexon_Prime_sector1']

export class MyRoom extends Room {
  maxClients = 10;
  state = new MyRoomState();

  teamPlayersCount(team: "blue" | "red" = "blue") {
    return [...this.state.players.values()].filter(p => p.team === team).length;
  }

  onCreate(options: any) {
    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.x += message.dx * 1.0;
      player.y += message.dy * 1.0;
    });

    this.onMessage("aim", (client, message) => {
      this.broadcast("aim-taken", message, { except: client })
    });
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const player = new Player();
    player.team = this.teamPlayersCount() % 2 ? "red" : "blue";
    player.x = Math.floor(Math.random() * 400);
    player.y = Math.floor(Math.random() * 400);
    player.sessionId = client.sessionId;
    // get a random avatar for the player
    player.avatar = avatars[Math.floor(Math.random() * avatars.length)];

    this.state.players.set(client.sessionId, player);

  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");

    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
