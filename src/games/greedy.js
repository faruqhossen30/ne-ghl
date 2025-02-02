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
  selectTime: 15,
  winOption: 0,
  round: 1,
};

const selectTimeEmitUpdate = async () => {
  const redisValue = await redisClient.get("greedyObj");
  const currentObject = await JSON.parse(redisValue);

  const roundNumber = currentObject.round;
  const gameId = 1;
  const CURRENT_TIMESTAMP = mysql.raw("CURRENT_TIMESTAMP()");
  // console.log("selectTimeEmitUpdate running ...");

  // display result emit
  if (currentObject.selectTime <= 0) {
    stopSelectTimeInter();
    // send winder user list
    // send win option list

    

    // 3. Winer get diamond update by firebase
    let winUsers = [];
    mysqlPool.query(
      "select * from `bets` WHERE DATE(created_at) = CURDATE() and `round` = ? and `status` = ? and `game_id` = ?",
      [roundNumber, "win", gameId],
      async function (err, rows, fields) {
        rows.map(async (data) => {
          let winUser = await {};
          const userRef = await db.collection("users").doc(data.user_uid);
          const docSnap = await userRef.get();
          const userData = await docSnap.data();
          const res = await userRef.update({
            diamond: FieldValue.increment(data.bet_amount * data.rate),
          });
          winUsers.push(userData.name)
          console.log(userData.name);
          
          
          // console.log('user id = ',data.user_id, "pabe -", data.bet_amount * data.rate);
          // console.log("this is data", data);
        });
        console.log('winUsers ind',winUsers);
      }      
    );

    console.log('winUsers',winUsers);
    

    greedy.emit("result", JSON.stringify(currentObject),winUsers);

    currentObject.selectTime = 15;
    currentObject.winOption = 0;
    currentObject.round = currentObject.round + 1;
    await redisClient.set("greedyObj", JSON.stringify(currentObject));
    setTimeout(async () => {
      startSelectTimeInterval();
    }, 3000);
  } else if (currentObject.selectTime == 6) {
    stopSelectTimeInter();
    currentObject.selectTime = currentObject.selectTime - 1;
    // Result Processing start
    // currentObject.winOption = 7;

    // start
    mysqlPool.query(
      "select sum(`bet_amount`) as bet_amount, sum(CASE WHEN status = 'win' THEN bet_amount * rate ELSE NULL END) as win_amount from `bets` WHERE DATE(created_at) = CURDATE()",
      function (err, result, fields) {
        const { bet_amount, win_amount } = result[0];
        const stock_amount = bet_amount - win_amount;
        const commission_amount = ((bet_amount - win_amount) / 100) * 10;
        const payable_amount = stock_amount - commission_amount;

        // console.log("stock_amount", stock_amount);
        // console.log("commission_amount", commission_amount);
        // console.log("payable_amount", payable_amount);

        // Round query
        mysqlPool.query(
          "SELECT option_id,sum(bet_amount*rate) as total FROM `bets` WHERE DATE(created_at) = CURDATE() and status = ? and `round` = ? GROUP BY option_id;",
          ["pending", roundNumber],
          async function (err, result, fields) {
            // if found submitted bets
            if (result.length) {
              let testArr = [];
              result.map(async (bet) => {
                if (bet.total <= payable_amount) {
                  testArr.push(bet.option_id);
                }
              });

              // if not found payable option
              if (testArr.length == 0) {
                const beted_ids = result.map((item)=> item.option_id)             
                testArr = [1,2,3,4,5,6,7,8].filter(item => !beted_ids.includes(item));               
              }

              const win_option =
                (await testArr[Math.floor(Math.random() * testArr.length)]) ??
                [2, 3, 4, 5][Math.floor(Math.random() * 4)];

              console.log("win_option 99 ", win_option);

              // 1. change status - pending-loss
              mysqlPool.query(
                "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and not `option_id` = ?",
                ["loss", CURRENT_TIMESTAMP, gameId, roundNumber, win_option],
                function (err, result, fields) {
                  // console.log('this is 1',err);
                }
              );

              // 2. change status - pending-win
              mysqlPool.query(
                "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and `option_id` = ?",
                ["win", CURRENT_TIMESTAMP, gameId, roundNumber, win_option],
                function (err, result, fields) {
                  // console.log('this is 2',err);
                }
              );
              currentObject.winOption = win_option;
              await redisClient.set("greedyObj", JSON.stringify(currentObject));
            }

            // if not bet submited
            if (result.length == 0) {
              currentObject.winOption = [1, 6, 7, 8][
                Math.floor(Math.random() * 4)
              ];
              await redisClient.set("greedyObj", JSON.stringify(currentObject));
            }
          }
        );
      }
    );
    // end

    await redisClient.set("greedyObj", JSON.stringify(currentObject));
    greedy.emit("game", JSON.stringify(currentObject));

    setTimeout(async () => {
      // Start result
      // Winder option
      startSelectTimeInterval();
    }, 4000);
  } else {
    currentObject.selectTime = currentObject.selectTime - 1;
    await redisClient.set("greedyObj", JSON.stringify(currentObject));
    greedy.emit("game", JSON.stringify(currentObject));
  }
};

let selectTimeInterval = setInterval(selectTimeEmitUpdate, 1000);

async function stopSelectTimeInter() {
  clearInterval(selectTimeInterval);
}

async function startSelectTimeInterval() {
  selectTimeInterval = setInterval(selectTimeEmitUpdate, 1000);
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
