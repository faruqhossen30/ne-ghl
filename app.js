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
const greddyGenerateWInPtion = require("./utils/greedyGenerateWinOption");
const gameOptiondData = require("./data/greedyOptions");
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
      mysqlPool.query(
          "select sum(`bet_amount`) as bet_amount, sum(CASE WHEN status = 'win' THEN bet_amount ELSE NULL END) as win_amount from `bets` WHERE DATE(created_at) = CURDATE()",
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
              [47],
              async function (err, result, fields) {
                // console.log(result);
                // item = result;
                if (result) {
                  
                  
                  const clonedArray = await gameOptiondData.map((x) => x);
      
                  result.map((bet) => {
                    const itemToUpdate = clonedArray.find(
                      (item) => item.option === bet.option_id
                    );
                    itemToUpdate.bet_amount += bet.bet_amount;
                    itemToUpdate.return_amount += bet.bet_amount * bet.rate;
                  //   console.log(bet.option_id);
                  });
      
                  const randNumber = clonedArray
                    .filter((item) => {
                      if (item.return_amount <= payable_amount) {
                        return item.option;
                      }
                    }).map(item => item.option);
                  // console.log('len', randNumber.length);
                  // res.send().status(200);
                  // console.log('randNumber', typeof randNumber);

                  const win_option = randNumber[Math.floor(Math.random() * randNumber.length) ];
                  
                  console.log('win_option',win_option);
                  
                }
              }
            );
          }
        );
    } catch (error) {
      console.log(error);
      
    }

    
    res.send('just for test');

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
