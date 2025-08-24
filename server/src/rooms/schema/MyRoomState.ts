import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
	@type('string') public sessionId: string;
	@type('string') public userId: string;
	@type('string') public avatar: string;
	@type('string') public name: string;
	@type("number") public x: number = 0;
	@type("number") public y: number = 0;
	@type("number") public spawn: number;
	@type("number") public health: number = 100;
	@type("string") public team: "blue" | "red" = "blue";
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();

	@type("number") public blueScore:number = 0;
	@type("number") public redScore:number = 0;
}
