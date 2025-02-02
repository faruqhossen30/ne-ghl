const cors = require("cors");
const { jwtDecode } = require("jwt-decode");
const path = require("path");
const { time } = require("console");
const { clearInterval } = require("timers");
require("dotenv").config();
const mysql = require("mysql2");
const { Random, pick } = require("random-js");

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
const greddyGenerateWInPtion = require("./utils/greedyGenerateWinOption");
const gameOptiondData = require("./data/greedyOptions");
// Games File
require("./src/games/greedy");

// Express Middleware
app.set("view engine", "ejs");
app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));

var CURRENT_TIMESTAMP = mysql.raw("CURRENT_TIMESTAMP()");
const roundNumber = 4;
const gameId = 1;

app.get("/", async (req, res) => {
  /*
    1. Total bet = 1,00,000
     - Total Win =   10,000
    -----------------------
                 =   90,000
    10%         = bet commission
    ---------------------------
                = available coin
    if available coin > payable coin -> better get win otheris 

    lowest abailwable better will be win
    

    
  */
  try {
    // sum query
    mysqlPool.query(
      "select sum(`bet_amount`) as bet_amount, sum(CASE WHEN status = 'win' THEN bet_amount * rate ELSE NULL END) as win_amount from `bets` WHERE DATE(created_at) = CURDATE()",
      function (err, result, fields) {
        console.log("sum of query = ", result);
        const { bet_amount, win_amount } = result[0];
        const stock_amount = bet_amount - win_amount;
        const commission_amount = ((bet_amount - win_amount) / 100) * 10;
        const payable_amount = stock_amount - commission_amount;

        console.log("stock_amount", stock_amount);
        console.log("commission_amount", commission_amount);
        console.log("payable_amount", payable_amount);

        mysqlPool.query(
          "select * from `bets` WHERE DATE(created_at) = CURDATE() and `round` = ? and `status` = ? and `game_id` = ?",
          [2, "loss",1],
          function (err, result, fields) {
            console.log(result.map((item)=> item.user_id));

            res.send(result);
          }
        );

        // Query for get option nuber
        mysqlPool.query(
          "SELECT option_id,sum(bet_amount*rate) as total FROM `bets` WHERE DATE(created_at) = CURDATE() and status = ? and `round` = ? GROUP BY option_id;",
          ["pending", roundNumber],
          async function (err, result, fields) {
            if (result.length) {
              let testArr = [];

              result.map(async (bet) => {
                if (bet.total <= payable_amount) {
                  console.log(
                    "payable =",
                    payable_amount,
                    "check = ",
                    bet.total
                  );
                  testArr.push(bet.option_id);
                }
              });

              console.log("testArr", testArr);

              const win_option =
                (await testArr[Math.floor(Math.random() * testArr.length)]) ??
                [2, 3, 4, 5][Math.floor(Math.random() * 4)];

              console.log(win_option);

              // // 1. change status - pending-loss
              // mysqlPool.query(
              //   "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and not `option_id` = ?",
              //   ["loss", CURRENT_TIMESTAMP, gameId, roundNumber, win_option],
              //   function (err, result, fields) {
              //     // console.log('this is 1',err);
              //   }
              // );

              // // 2. change status - pending-win
              // mysqlPool.query(
              //   "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and `option_id` = ?",
              //   ["win", CURRENT_TIMESTAMP, gameId, roundNumber, win_option],
              //   function (err, result, fields) {
              //     // console.log('this is 2',err);
              //   }
              // );
            }

            // res.send(result);
          }
        );
      }
    );
  } catch (error) {
    console.log(error);
  }

  // res.send("just for test");

  // End

  // const redisValue = await redisClient.get("greedyObj");
  // const currentObject = await JSON.parse(redisValue);
  // const roundNumber = currentObject.round;

  // mysqlPool.query(
  //   "update `bets` set `status` = ?, `bets`.`updated_at` = ? where `game_id` = ? and `round` = ? and not `option` = ?",
  //   ["loss", CURRENT_TIMESTAMP, gameId, roundNumber, winOption],
  //   function (err, result, fields) {
  //     console.log("hid", result);
  //   }
  // );

  // res.send('gfgh');
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
