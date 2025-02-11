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
res.send('welcome to hompage');
});
app.get("/one", async (req, res) => {
  // 2.1 Winer get diamond update by firebase

  // 2.2 win record list
  // const greediesRef = db.collection("greedies");
  // const snapshot = await greediesRef
  //   .where("createdAt", ">=", startTimestamp)
  //   .where("createdAt", "<=", endTimestamp)
  //   .where("round", "==", 1)
  //   .where("status", "==", "win")
  //   .get();
  // // 2.2 winer user and win amount list
  // const resultUsers = [];
  // if (!snapshot.empty) {
  //   let batch = db.batch();
  //   snapshot.forEach((doc) => {
  //     console.log(doc.data());

  //     const betData = doc.data();
  //     resultUsers.push({
  //       wind_amount: betData.betAmount * betData.rate,
  //       ...betData,
  //     });
  //     batch.update(betData.userRef, {
  //       diamond: FieldValue.increment(betData.betAmount * betData.rate),
  //     });
  //   });
  //   await batch.commit();
  // }

  res.send('one');
});
app.get("/redis", async (req, res) => {
//   // const redisWinRecords = await redisClient.get("greedyWinRecourds");
//   // const redisWinRecordsArr = await JSON.parse(redisWinRecords);
//   // await redisWinRecordsArr.unshift(Math.floor(Math.random() * 8));
//   // await redisWinRecordsArr.pop();
//   // await redisClient.set("greedyWinRecourds", JSON.stringify(redisWinRecordsArr));

//   // const r = await redisClient.get("greedyWinRecourds");
//   // const a = await JSON.parse(r);
//   res.send('radis');
// });
// app.get("/calculate", async (req, res) => {
//   // 1.1 get total beted amount
//   const coll = await db.collection("greedies");
//   // .where("createdAt", ">=", startTimestamp)
//   // .where("createdAt", "<=", endTimestamp);
//   const sumAggregateQuery = await coll.aggregate({
//     totalBetAmount: AggregateField.sum("betAmount"),
//   });

//   const snapshot = await sumAggregateQuery.get();
//   const totalBetAmount = await snapshot.data().totalBetAmount;

//   // 1.2 get total win amount
//   const totalWinCollectionRef = db
//     .collection("greedies")
//     // .where("createdAt", ">=", startTimestamp)
//     // .where("createdAt", "<=", endTimestamp)
//     .where("status", "==", "win");

//   const sumWinAggregateQuery = await totalWinCollectionRef.aggregate({
//     totalBetAmount: AggregateField.sum("returnAmount"),
//   });

//   const totalWinAmountSnapshot = await sumWinAggregateQuery.get();
//   const totalWinAmount = await totalWinAmountSnapshot.data().totalBetAmount;

//   // 1.3 calculating
//   const stockAmount = totalBetAmount - totalWinAmount;
//   const commissionAmount = (stockAmount / 100) * 10;
//   const payableAmount = stockAmount - commissionAmount;

//   const data = {
//     totalDiamond: totalBetAmount,
//     totalWinAmount: totalWinAmount,
//     stockAmount: stockAmount,
//     commissionAmount: commissionAmount,
//     payableAmount: payableAmount,
//   };

  res.send('calculate');
});

app.get("/query", async (req, res) => {

  res.send('weclome');
});

app.get("/test", async (req, res) => {
  res.send("serveris working");
});

app.get("/resultuser", async (req, res) => {
  const winBets = await db
    .collection("greedies")
    // .where("createdAt", ">=", startTimestamp)
    // .where("createdAt", "<=", endTimestamp)
    .where("status", "==", "win")
    .get();

  const items = await winBets.docs.map((item) => {
    const betData = item.data();
    return betData;
  });

  const groupedData = await items.reduce((acc, item) => {
    if (!acc[item.userId]) {
      acc[item.userId] = {
        userId: item.userId,
        userRef: item.userRef,
        count: 0,
        totalReturnAmount: 0,
      };
    }
    acc[item.userId].count += 1;
    acc[item.userId].totalReturnAmount += item.returnAmount;
    return acc;
  }, {});

  const result = await Object.values(groupedData).sort(
    (a, b) => b.totalReturnAmount - a.totalReturnAmount
  );

  // Fetch user data from Firestore
  const userPromises = await result.map(async (item) => {
    const userDoc = await item.userRef.get();
    const userData = await userDoc.data();
    return userDoc.exists
      ? { winAmount: item.totalReturnAmount, name:userData.name,photoURL:userData.photoURL }
      : null;
  });

  const resultUsers = await Promise.all(userPromises);

  // const finalResult = result.map((item) => {
  //   const userData = item.userRef.data();

  //   return { user: userData, ...item };
  // });

  res.send(resultUsers);
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
