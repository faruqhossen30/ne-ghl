const mysql = require("mysql2");
const { clearInterval } = require("timers");
const { redisClient } = require("../../config/redis");
const { io } = require("../../config/socket");
const { mysqlPool } = require("../../config/db");
const { db } = require("../../config/firebaseDB");
const { FieldValue } = require("firebase-admin/firestore");
const gameOptiondData = require("../../data/greedyOptions");

const greedy = io.of("/greedy");

const greedyObj = {
  selectTime: 10,
  resultTime: 0,
  select: true,
  result: false,
  interval: true,
  winOption: 0,
  round: 1,
};

const updateValueInRedis = async () => {
  const redisValue = await redisClient.get("greedyObj");
  const currentObject = await JSON.parse(redisValue);

  // const winOption = 2;
  const roundNumber = currentObject.round;
  const gameId = 1;

  // let winRecord = [0, 0, 0, 0, 0];

  let winRecord = [1, 2, 3, 4, 5];

  function addToArray(num) {
    winRecord.unshift(num); // Add new element at the beginning
    winRecord.pop();        // Remove last element
      console.log(winRecord); // Display updated array
  }

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
        currentObject.winOption = 0;

        var CURRENT_TIMESTAMP = mysql.raw("CURRENT_TIMESTAMP()");

        // Greedy game win optin start

        // start
        mysqlPool.query(
          "select sum(`bet_amount`) as bet_amount, sum(CASE WHEN status = 'win' THEN bet_amount * rate ELSE NULL END) as win_amount from `bets` WHERE DATE(created_at) = CURDATE()",
          function (err, result, fields) {
            console.log("result = ", result);
            const { bet_amount, win_amount } = result[0];
            const stock_amount = bet_amount - win_amount;
            const commission_amount = ((bet_amount - win_amount) / 100) * 10;
            const payable_amount = stock_amount - commission_amount;

            console.log("stock_amount", stock_amount);
            console.log("commission_amount", commission_amount);
            console.log("payable_amount", payable_amount);

            mysqlPool.query(
              "select *, bet_amount * rate AS return_amount from `bets` WHERE DATE(created_at) = CURDATE() and `round` = ?",
              [roundNumber],
              async function (err, result, fields) {
                // console.log(result);
                // item = result;
                if (result) {
                  const clonedArray = await gameOptiondData.map((x) => x);

                  result.map((bet) => {
                    const itemToUpdate = clonedArray.find(
                      (item) => item.option === bet.option
                    );
                    itemToUpdate.bet_amount += bet.bet_amount;
                    itemToUpdate.return_amount += bet.bet_amount * bet.rate;
                    //   console.log(bet.option);
                  });

                  const randNumber = await clonedArray
                    .filter((item) => {
                      if (item.return_amount <= payable_amount) {
                        return item.option;
                      }
                    })
                    .map((item) => item.option);
                  // console.log('len', randNumber.length);
                  // res.send().status(200);
                  // console.log('randNumber', typeof randNumber);

                  // Final Winer Option
                  const win_option = await randNumber[
                    Math.floor(Math.random() * randNumber.length)
                  ];
                  addToArray(win_option)

                  // 1. change status - pending-loss
                  mysqlPool.query(
                    "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and not `option` = ?",
                    [
                      "loss",
                      CURRENT_TIMESTAMP,
                      gameId,
                      roundNumber,
                      win_option,
                    ],
                    function (err, result, fields) {
                      // console.log('this is 1',result);
                    }
                  );

                  // 2. change status - pending-win
                  mysqlPool.query(
                    "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and `option` = ?",
                    ["win", CURRENT_TIMESTAMP, gameId, roundNumber, win_option],
                    function (err, result, fields) {
                      // console.log('this is 2',result);                     
                    }
                  );

                  currentObject.winOption = await win_option;
                  // 3. Winer get diamond update by firebase

                  // Start again
                  await redisClient.set(
                    "greedyObj",
                    JSON.stringify(currentObject)
                  );
                  await startInterval();

                  console.log("win_option", win_option);
                }
              }
            );
          }
        );
        // end

        // Greedy game win optin End
      } catch (error) {
        console.log("this is error", error);
      }

      // console.log("select time ses calculting suru");
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

      // setTimeout(async () => {
      currentObject.selectTime = 30;
      currentObject.resultTime = 0;
      currentObject.select = true;
      currentObject.result = false;
      currentObject.interval = true;
      currentObject.round = currentObject.round + 1;
      await redisClient.set("greedyObj", JSON.stringify(currentObject));

      greedy.emit("result", JSON.stringify(currentObject), winRecord);

      // 3. Winer get diamond update by firebase
      mysqlPool.query(
        "select * from `bets` where `game_id` = ? and `round` = ? and `status` = ?",
        [gameId, roundNumber, "win"],
        function (err, rows, fields) {
          rows.map((data) => {
            const userRef = db.collection("users").doc(data.user_uid);
            const res = userRef.update({
              diamond: FieldValue.increment(data.bet_amount * data.rate),
            });
            // console.log('user id = ',data.user_id, "pabe -", data.bet_amount * data.rate);
            console.log("this is data", data);
          });
        }
      );

      setTimeout(async () => {
        await startInterval();
        console.log("result display dekan ses");
      }, 4000);

      // }, 3000);

      // console.log("result time ses diplay show");
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
