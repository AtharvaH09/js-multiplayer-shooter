/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually
 * instantiate a Colyseus Server as documented here:
 *
 * See: https://docs.colyseus.io/server/api/#constructor-options
 */
import { listen } from "@colyseus/tools";
import dotenv from "dotenv";
import path from "path";

// Load env depending on NODE_ENV
dotenv.config({
  path: path.resolve(
    __dirname,
    `../.env.${process.env.NODE_ENV || "development"}`
  ),
});

// Import Colyseus config
import app from "./app.config";

// Debug: check SERVER_TOKEN is loaded
console.log("SERVER_TOKEN:", process.env.SERVER_TOKEN);

// Create and listen on 2567 (or PORT environment variable.)
listen(app);