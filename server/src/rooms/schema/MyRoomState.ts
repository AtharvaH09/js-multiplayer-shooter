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

export class Bullet extends Schema {
  @type("string") public id: string;
  @type("string") public shooterId: string;
  @type("number") public x: number;
  @type("number") public y: number;
  @type("number") public dirX: number;
  @type("number") public dirY: number;
  
  // Damage-related
  @type("number") public baseDamage: number;  // max damage at 0 distance
  @type("number") public maxRange: number;    // max effective range
  @type("number") public minDamage: number;   // minimum damage (after falloff)
  
  // Gameplay
  @type("number") public speed: number;       // travel speed of bullet
  @type("number") public fireRate: number;    // how fast weapon fires
}


export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Bullet }) bullets = new MapSchema<Bullet>();

	@type("number") public blueScore:number = 0;
	@type("number") public redScore:number = 0;
}
