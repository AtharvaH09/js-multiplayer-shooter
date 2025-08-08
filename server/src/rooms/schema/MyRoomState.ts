import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
	@type('string') public sessionId: string;
	@type('string') public userId: string;
	@type('string') public avatar: string;
	@type('string') public name: string;
	@type("number") public x: number = 0;
	@type("number") public y: number = 0;
	@type("number") public health: number = 100;
	@type("string") public team: "blue" | "red" = "blue";
}

export class Bullet extends Schema {
	@type("number") public id: string;
	@type('string') public shooterId: string;
	@type("number") public x: number;
	@type("number") public y: number;
	@type("number") public dirX: number;
	@type("number") public dirY: number;
	@type("number") public damage: number;
	@type("number") public spawnTime: number;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Bullet }) bullets = new MapSchema<Bullet>();

	@type("number") public blueScore:number = 0;
	@type("number") public redScore:number = 0;
}
