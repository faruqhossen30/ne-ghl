const cors = require("cors");
const { jwtDecode } = require("jwt-decode");
const path = require("path");
const { time } = require("console");
const { clearInterval } = require("timers");
require("dotenv").config();
const mysql = require("mysql2");
const { Random, pick } = require("random-js");

// Config file
const { FieldValue, AggregateField } = require("firebase-admin/firestore");
const { redisClient, radisURL } = require("./config/redis");
const { app, express, server } = require("./config/server");
const { io } = require("./config/socket");
const { greedyObj, greedyWinRecourds } = require("./src/games/greedy");
const { luckyWheelObj } = require("./src/games/luckywheel");
const greddyGenerateWInPtion = require("./utils/greedyGenerateWinOption");
const { mysqlPool } = require("./config/db");
const { db } = require("./config/firebaseDB");
const { startTimestamp, endTimestamp } = require("./utils/dateGenerate");

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
          [2, "loss", 1],
          function (err, result, fields) {
            console.log(result.map((item) => item.user_id));

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
app.get("/one", async (req, res) => {
  // 2.1 Winer get diamond update by firebase
  
  // 2.2 win record list
  const greediesRef = db.collection("greedies");
  const snapshot = await greediesRef
    .where("createdAt", ">=", startTimestamp)
    .where("createdAt", "<=", endTimestamp)
    .where("round", "==", 1)
    .where("status", "==", "win")
    .get();
// 2.2 winer user and win amount list
  const resultUsers = [];
  if (!snapshot.empty) {
    let batch = db.batch();
    snapshot.forEach((doc) => {
      console.log(doc.data());

      const betData = doc.data();
      resultUsers.push({
        wind_amount: betData.betAmount * betData.rate,
        ...betData,
      });
      batch.update(betData.userRef, {
        diamond: FieldValue.increment(betData.betAmount*betData.rate),
      });
    });
    await batch.commit();
  }
 

  res.send(resultUsers);
});
app.get("/redis", async (req, res) => {
  // const redisWinRecords = await redisClient.get("greedyWinRecourds");
  // const redisWinRecordsArr = await JSON.parse(redisWinRecords);
  // await redisWinRecordsArr.unshift(Math.floor(Math.random() * 8));
  // await redisWinRecordsArr.pop();
  // await redisClient.set("greedyWinRecourds", JSON.stringify(redisWinRecordsArr));

  // const r = await redisClient.get("greedyWinRecourds");
  // const a = await JSON.parse(r);
  res.send(a)

});

app.get("/query", async (req, res) => {
  try {
    // const collectionRef = db.collection("greedies");
    // 1.1 get total beted amount
    const coll = await db
      .collection("greedies")
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp);
    const sumAggregateQuery = await coll.aggregate({
      totalBetAmount: AggregateField.sum("betAmount"),
    });

    const snapshot = await sumAggregateQuery.get();
    const totalBetAmount = await snapshot.data().totalBetAmount;

    // 1.2 get total win amount
    const totalWinCollectionRef = db
      .collection("greedies")
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .where("status", "==", "win");

    const sumWinAggregateQuery = await totalWinCollectionRef.aggregate({
      totalBetAmount: AggregateField.sum("betAmount"),
    });

    const totalWinAmountSnapshot = await sumWinAggregateQuery.get();
    const totalWinAmount = await totalWinAmountSnapshot.data().totalBetAmount;

    // 1.3 calculating
    const stockAmount = totalBetAmount - totalWinAmount;
    const commissionAmount = (stockAmount / 100) * 10;
    const payableAmount = stockAmount - commissionAmount;

    const data = {
      stockAmount: stockAmount,
      commissionAmount: commissionAmount,
      payableAmount: payableAmount,
    };

    // Fetch documents round bets and process for winners
    // 1.4
    const singleRoundQuery = await db
      .collection("greedies")
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .where("round", "==", 2)
      .get();

    if (singleRoundQuery.empty) {
      // If no bets were submitted, choose a random fallback win option
      // currentObject.winOption = [1, 6, 7, 8][Math.floor(Math.random() * 4)];
      // await redisClient.set("greedyObj", JSON.stringify(currentObject));
      console.log("singleRoundQuery is empty");
    }

    if (!singleRoundQuery.empty) {
      // document to to json data
      const items = singleRoundQuery.docs.map((item) => {
        const itemData = item.data();
        let totalReturnAmount = item.data();
        return {
          id: item.id,
          round: itemData.round,
          optionId: itemData.optionId,
          betAmount: itemData.betAmount,
          rate: itemData.rate,
          returnAmount: itemData.betAmount * itemData.rate,
        };
      });
      // Json data to uniq with groupby data
      const uniqueData = Object.values(
        items.reduce((acc, item) => {
          if (!acc[item.optionId]) {
            acc[item.optionId] = { ...item, total: 0 };
          }
          acc[item.optionId].total += item.betAmount * item.rate;
          return acc;
        }, {})
      );

      // Collect valid optionId that fit within payableAmount
      let testArr = [];
      uniqueData.forEach((bet) => {
        if (bet.total <= payableAmount) {
          testArr.push(bet.optionId);
        }
      });

      // If no payable option is found, select an alternative set
      if (testArr.length === 0) {
        const betedIds = uniqueData.map((item) => item.optionId);
        testArr = [1, 2, 3, 4, 5, 6, 7, 8].filter(
          (item) => !betedIds.includes(item)
        );
      }

      // Randomly select a winning option
      const win_option = testArr.length
        ? testArr[Math.floor(Math.random() * testArr.length)]
        : [2, 3, 4, 5][Math.floor(Math.random() * 4)];

      console.log("Win option:", win_option);

      // 1. Update status of non-winning bets to "loss/win"
      const singleRoundQueryForUpdate = await db
        .collection("greedies")
        .where("createdAt", ">=", startTimestamp)
        .where("createdAt", "<=", endTimestamp)
        .where("round", "==", 2)
        .get();

      let batch = await db.batch();
      singleRoundQueryForUpdate.forEach((doc) => {
        const docData = doc.data();
        batch.update(doc.ref, {
          status: docData.optionId == win_option ? "win" : "loss",
        });
      });
      await batch.commit();
    }

    res.send(data);
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: error.message });
  }

  // res.send('weclome');
});

app.get("/test", async (req, res) => {
  res.send("serveris working");
});
server.listen(3000, async () => {
  await redisClient.connect(radisURL).then(() => {
    console.log("redis connect");
  });
  redisClient.set("count", 10);
  redisClient.set("greedyObj", JSON.stringify(greedyObj));
  redisClient.set("greedyWinRecourds", JSON.stringify(greedyWinRecourds));
  redisClient.set("luckyWheelObj", JSON.stringify(luckyWheelObj));

  console.log(`server running ${process.env.APP_URL}`);
});
