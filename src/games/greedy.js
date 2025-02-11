const mysql = require("mysql2");
const { FieldValue, AggregateField } = require("firebase-admin/firestore");
const { clearInterval } = require("timers");
const { redisClient } = require("../../config/redis");
const { io } = require("../../config/socket");
const { mysqlPool } = require("../../config/db");
const { db } = require("../../config/firebaseDB");
const gameOptiondData = require("../../data/greedyOptions");
const { startTimestamp, endTimestamp } = require("../../utils/dateGenerate");

const greedy = io.of("/greedy");

const greedyObj = {
  selectTime: 15,
  winOption: 0,
  round: 1,
};
const greedyWinRecourds = [1, 2, 3, 4, 5, 6, 7, 8];

const selectTimeEmitUpdate = async () => {
  const redisValue = await redisClient.get("greedyObj");
  const currentObject = await JSON.parse(redisValue);
  const roundNumber = currentObject.round;

  // display result emit
  if (currentObject.selectTime <= 0) {
    stopSelectTimeInter();

    const greediesRef = db.collection("greedies");
    const snapshot = await greediesRef
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .where("round", "==", roundNumber)
      .where("status", "==", "win")
      .get();
    // 2.2 winer user and win amount list
    if (!snapshot.empty) {
      let batch = db.batch();
      snapshot.forEach((doc) => {

        const betData = doc.data();
        batch.update(betData.userRef, {
          diamond: FieldValue.increment(betData.returnAmount),
        });
      });
      await batch.commit();
    }

// Result user status
    const items = await snapshot.docs.map((item) => {
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
    // result user end




    const redisWinRecords = await redisClient.get("greedyWinRecourds");
    const winRecords = await JSON.parse(redisWinRecords);

    

    greedy.emit("result", JSON.stringify(currentObject), resultUsers ?? [], winRecords);

    currentObject.selectTime = 30;
    currentObject.winOption = 0;
    currentObject.round = currentObject.round + 1;
    await redisClient.set("greedyObj", JSON.stringify(currentObject));
    setTimeout(async () => {
      startSelectTimeInterval();
    }, 5000);
  } else if (currentObject.selectTime == 6) {
    stopSelectTimeInter();
    currentObject.selectTime = currentObject.selectTime - 1;

    // copy start
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

      // Update for fix
    const sumWinAggregateQuery = await totalWinCollectionRef.aggregate({
      totalBetAmount: AggregateField.sum("returnAmount"),
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
      .where("round", "==", roundNumber)
      .get();

    if (singleRoundQuery.empty) {
      // If no bets were submitted, choose a random fallback win option
      const win_option = [1, 6, 7, 8][Math.floor(Math.random() * 4)];
      currentObject.winOption = win_option;

      // for generate winrecourd option
      const redisWinRecords = await redisClient.get("greedyWinRecourds");
      const redisWinRecordsArr = await JSON.parse(redisWinRecords);
      await redisWinRecordsArr.unshift(win_option);
      await redisWinRecordsArr.pop();
      await redisClient.set(
        "greedyWinRecourds",
        JSON.stringify(redisWinRecordsArr)
      );

      console.log("singleRoundQuery is empty");
    }

    if (!singleRoundQuery.empty) {
      // document to json data
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
      const win_option = (await testArr.length)
        ? testArr[Math.floor(Math.random() * testArr.length)]
        : [2, 3, 4, 5][Math.floor(Math.random() * 4)];

      console.log("Win option:", win_option);

      // 1. Update status of bets to "loss/win"
      const singleRoundQueryForUpdate = await db
        .collection("greedies")
        .where("createdAt", ">=", startTimestamp)
        .where("createdAt", "<=", endTimestamp)
        .where("round", "==", roundNumber)
        .get();

      let batch = await db.batch();
      singleRoundQueryForUpdate.forEach((doc) => {
        const docData = doc.data();
        batch.update(doc.ref, {
          status: docData.optionId == win_option ? "win" : "loss",
        });
      });
      await batch.commit();
      // for generate winrecourd option
      const redisWinRecords = await redisClient.get("greedyWinRecourds");
      const redisWinRecordsArr = await JSON.parse(redisWinRecords);
      await redisWinRecordsArr.unshift(win_option);
      await redisWinRecordsArr.pop();
      await redisClient.set(
        "greedyWinRecourds",
        JSON.stringify(redisWinRecordsArr)
      );
    }

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

module.exports = { greedyObj, greedyWinRecourds };
