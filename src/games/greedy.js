const mysql = require("mysql2");
const { clearInterval } = require("timers");
const { redisClient } = require("../../config/redis");
const { io } = require("../../config/socket");
const { mysqlPool } = require("../../config/db");
const { db } = require("../../config/firebaseDB");
const { FieldValue } = require("firebase-admin/firestore");

const greedy = io.of("/greedy");

const greedyObj = {
  selectTime: 10,
  resultTime: 0,
  select: true,
  result: false,
  interval: true,
  round: 1,
};

const updateValueInRedis = async () => {
  const redisValue = await redisClient.get("greedyObj");
  const currentObject = await JSON.parse(redisValue);

  const winOption = 2;
  const roundNumber = currentObject.round;
  const gameId = 1;

  // Select time section
  if (currentObject.select) {
    if (currentObject.selectTime == 0 && currentObject.resultTime == 0) {
      clearInterval(greedyInterval);
      try {
        currentObject.selectTime = 0;
        currentObject.resultTime = 5;
        currentObject.select = false;
        currentObject.result = true;
        currentObject.interval = true;

        var CURRENT_TIMESTAMP = mysql.raw('CURRENT_TIMESTAMP()');
        // 1. change status - pending-loss
        mysqlPool.query(
          "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and not `option` = ?",
          ["loss", CURRENT_TIMESTAMP, gameId, roundNumber, winOption],
          function (err, result, fields) {
            // console.log('this is 1',result);
          }
        );

        // 2. change status - pending-win
        mysqlPool.query(
          "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and `option` = ?",
          ["win", CURRENT_TIMESTAMP, gameId, roundNumber, winOption],
          function (err, result, fields) {
            // console.log('this is 2',result);
          }
        );
        // 3. Winer get diamond update by firebase

        // Start again
        await redisClient.set("greedyObj", JSON.stringify(currentObject));
        await startInterval();
      } catch (error) {
        console.log('this is error',error);
      }

      console.log("select time ses calculting suru");
    }

    if (currentObject.selectTime > 0) {
      currentObject.selectTime = currentObject.selectTime - 1;
      await redisClient.set("greedyObj", JSON.stringify(currentObject)); // Update the value in Redis
      greedy.emit("game", JSON.stringify(currentObject));
    }
    // console.log("select timing running", Math.floor(Math.random() * 5));
  }

  // Result time section
  if (currentObject.result) {
    if (currentObject.selectTime == 0 && currentObject.resultTime == 0) {
      clearInterval(greedyInterval);

      setTimeout(async () => {
        currentObject.selectTime = 10;
        currentObject.resultTime = 0;
        currentObject.select = true;
        currentObject.result = false;
        currentObject.interval = true;
        currentObject.round = currentObject.round + 1;
        await redisClient.set("greedyObj", JSON.stringify(currentObject));
        greedy.emit("result", JSON.stringify(currentObject));

        // 3. Winer get diamond update by firebase
        mysqlPool.query(
          "select * from `bets` where `game_id` = ? and `round` = ? and `option` = ?",
          [gameId, roundNumber, winOption],
          function (err, rows, fields) {
            rows.map((data) => {
              const userRef = db.collection("users").doc(data.user_uid);
              const res = userRef.update({
                diamond: FieldValue.increment(data.bet_amount * data.rate),
              });
              // console.log('user id = ',data.user_id, "pabe -", data.bet_amount * data.rate);
              console.log('this is data',data);
            });
          }
        );

        await startInterval();
        console.log("result display dekan ses");
      }, 3000);

      console.log("result time ses diplay show");
    }

    if (currentObject.resultTime > 0) {
      currentObject.resultTime = currentObject.resultTime - 1;
      await redisClient.set("greedyObj", JSON.stringify(currentObject)); // Update the value in Redis
      greedy.emit("game", JSON.stringify(currentObject));
    }
    // console.log("result timing running", Math.floor(Math.random() * 5));
  }

  // console.log("interverl running", Math.floor(Math.random() * 5));
};

// Call the function every second
let greedyInterval = setInterval(updateValueInRedis, 1000);

async function startInterval() {
  greedyInterval = setInterval(updateValueInRedis, 1000);
}

// Socket.io setup
greedy.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

  // Send the current value to the newly connected client
  redisClient.get("count").then((value) => {
    socket.emit("game", value);
  });
});

module.exports = { greedyObj };
