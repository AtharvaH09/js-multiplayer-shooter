import { Schema, MapSchema, type } from '@colyseus/schema';

export class Gun extends Schema {
	@type('string') name: string = "pistol";
	@type('number') ammo: number = 30;
	@type('number') magSize: number = 30;
	@type('number') reserveAmmo: number = 90;
	@type('number') maxReserveAmmo: number = 90;
	@type('number') fireRate: number;
	@type('boolean') isReloading: boolean = false;
	@type("number") reloadTime: number = 2000;
}

export class Player extends Schema {
	@type('string') public sessionId: string;
	@type('string') public userId: string;
	@type('string') public avatar: string;
	@type('string') public name: string;
	@type("number") public x: number = 0;
	@type("number") public y: number = 0;
	@type("number") public spawn: number;
	@type("number") public health: number = 100;
	@type("number") public maxHealth: number = 100;
	@type("boolean") public isAlive: boolean = true;
	@type("boolean") public isInvincible: boolean = false;
	@type("string") public team: "blue" | "red" = "blue";
	@type("number") public kills: number = 0;
	@type("number") public deaths: number = 0;

	@type(Gun) public gun: Gun = new Gun;
}

export class MyRoomState extends Schema {
	@type({ map: Player }) players = new MapSchema<Player>();

	// Team Scores
	@type("number") public blueScore: number = 0;
	@type("number") public redScore: number = 0;

	// GAME STATE
	@type("string") public gameState: "waiting" | "countdown" | "in-progress" | "ended" = "waiting";
	@type("number") public countdown: number = 0; // seconds until match starts (countdown state)
	@type("number") public roundTime: number = 0; // seconds remaining in the round (in-progress)

	// configurable server-side defaults (optional)
	@type("number") public minPlayersPerTeam: number = 1;
	@type("number") public roundDuration: number = 300; // default 5 minutes
	@type("number") public startCountdown: number = 60; // default 60 sec pre-start count
}
