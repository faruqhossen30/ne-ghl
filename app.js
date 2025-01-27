const cors = require("cors");
const { jwtDecode } = require("jwt-decode");
const path = require("path");
const { time } = require("console");
const { clearInterval } = require("timers");
require("dotenv").config();
const mysql = require("mysql2");

// Config file
const mysqlPool = mysql.createPool({
  host: "localhost",
  user: "root",
  database: "honeylive",
  password: "",
});

const { FieldValue } = require("firebase-admin/firestore");
const { redisClient, radisURL } = require("./config/redis");
const { app, express, server } = require("./config/server");
const { io } = require("./config/socket");
const { greedyObj } = require("./src/games/greedy");
const { luckyWheelObj } = require("./src/games/luckywheel");
// Games File
require("./src/games/greedy");

// Express Middleware
app.set("view engine", "ejs");
app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));

var CURRENT_TIMESTAMP = mysql.raw("CURRENT_TIMESTAMP()");
const winOption = 2;
const gameId = 1;

app.get("/", async (req, res) => {
  /*
    1. Total bet = amount
     - Total Win = amount
    --------------------
                = profit
    10%         = bet commission
    ---------------------------
                = available coin
    if available coin > payable coin -> better get win otheris 

    lowest abailwable better will be win
    

    
  */

  const redisValue = await redisClient.get("greedyObj");
  const currentObject = await JSON.parse(redisValue);
  const roundNumber = currentObject.round;

  mysqlPool.query(
    "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and not `option` = ?",
    ["loss", CURRENT_TIMESTAMP, gameId, roundNumber, winOption],
    function (err, result, fields) {
      console.log("hid", result);
    }
  );

  res.send("some");
});

server.listen(3000, async () => {
  await redisClient.connect(radisURL).then(() => {
    console.log("redis connect");
  });
  redisClient.set("count", 10);
  redisClient.set("greedyObj", JSON.stringify(greedyObj));
  redisClient.set("luckyWheelObj", JSON.stringify(luckyWheelObj));

  console.log("listening on http://192.168.0.112:3000");
});
