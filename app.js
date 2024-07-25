const envConfig = require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Ably = require("ably");
const p2 = require("p2");
const app = express();
const ABLY_API_KEY = process.env.ABLY_API_KEY;

const CANVAS_HEIGHT = 750;
const CANVAS_WIDTH = 1400;
const SHIP_PLATFORM = 718;
const PLAYER_VERTICAL_INCREMENT = 20;
const PLAYER_VERTICAL_MOVEMENT_UPDATE_INTERVAL = 1000;
const PLAYER_SCORE_INCREMENT = 5;
const P2_WORLD_TIME_STEP = 1 / 16;
const MIN_PLAYERS_TO_START_GAME = 3;
const GAME_TICKER_MS = 100;

let peopleAccessingTheWebsite = 0;
let players = {};
let playerChannels = {};
let shipX = Math.floor((Math.random() * 1370 + 30) * 1000) / 1000;
let shipY = SHIP_PLATFORM;
let avatarColors = ["green", "cyan", "yellow"];
let avatarTypes = ["A", "B", "C"];
let gameOn = false;
let alivePlayers = 0;
let totalPlayers = 0;
let gameRoom;
let deadPlayerCh;
let gameTickerOn = false;
let bulletTimer = 0;
let shipBody;
let world;
let shipVelocityTimer = 0;
let killerBulletId = "";
let copyOfShipBody = {
  position: "",
  velocity: "",
};

const realtime = new Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false,
});

//create a uniqueId to assign to clients on auth
const uniqueId = function () {
  return "id-" + totalPlayers + Math.random().toString(36).substr(2, 16);
};

app.use(express.json());
app.use(express.static("js"));

app.get("/auth", (request, response) => {
  const tokenParams = { clientId: uniqueId() };
  realtime.auth.createTokenRequest(tokenParams, function (err, tokenRequest) {
    if (err) {
      response
        .status(500)
        .send("Error requesting token: " + JSON.stringify(err));
    } else {
      response.setHeader("Content-Type", "application/json");
      response.send(JSON.stringify(tokenRequest));
    }
  });
});

app.get("/", (request, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  if (++peopleAccessingTheWebsite > MIN_PLAYERS_TO_START_GAME) {
    response.sendFile(__dirname + "/views/gameRoomFull.html");
  } else {
    response.sendFile(__dirname + "/views/intro.html");
  }
});

app.get("/gameplay", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/winner", (request, response) => {
  response.sendFile(__dirname + "/views/winner.html");
});

app.get("/gameover", (request, response) => {
  response.sendFile(__dirname + "/views/gameover.html");
});

module.exports = app;
