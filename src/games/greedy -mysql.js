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

  // display result emit
  if (currentObject.selectTime <= 0) {
    stopSelectTimeInter();

    // 3. Winer get diamond update by firebase
    const [rows] = await mysqlPool.query(
      "select * from `bets` WHERE DATE(created_at) = CURDATE() and `round` = ? and `status` = ? and `game_id` = ?",
      [roundNumber, "win", gameId]
    );

    // Fetch user data from Firestore
    const userPromises = await rows.map(async (item) => {
      // add diamond start
      const userRef = await db.collection("users").doc(item.user_uid);
      const res = await userRef.update({
        diamond: FieldValue.increment(item.bet_amount * item.rate),
      });
      // add diamond end

      const userDoc = await db.collection("users").doc(item.user_uid).get();
      return userDoc.exists
        ? { wind_amount: item.bet_amount * item.rate, ...userDoc.data() }
        : null;
    });

    const resultUsers = await Promise.all(userPromises);
    // const [winRecords] = await mysqlPool.query("select * from `win_options` where `game_id` = 1 order by `created_at` desc limit 3");
    const [winRecords] = await mysqlPool.query(
      "SELECT win_options.*, game_options.id,game_options.name,game_options.img FROM win_options LEFT JOIN game_options ON win_options.option_id = game_options.id WHERE win_options.game_id = 1 ORDER BY win_options.created_at DESC LIMIT 8"
    );

    greedy.emit(
      "result",
      JSON.stringify(currentObject),
      resultUsers ?? [],
      winRecords
    );

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
    // Result Processing start
    // currentObject.winOption = 7;

    // start
    const [rows] = await mysqlPool.query(
      "SELECT SUM(`bet_amount`) AS bet_amount, SUM(CASE WHEN status = 'win' THEN bet_amount * rate ELSE NULL END) AS win_amount FROM `bets` WHERE DATE(created_at) = CURDATE()"
    );

    const { bet_amount, win_amount } = rows[0] || {
      bet_amount: 0,
      win_amount: 0,
    }; // Default values to avoid undefined errors

    const stock_amount = bet_amount - win_amount; // Fixing incorrect variable usage
    const commission_amount = (stock_amount / 100) * 10;
    const payable_amount = stock_amount - commission_amount;

    // Fetch round bets and process winners
    const roundQuery = await mysqlPool.query(
      "SELECT option_id, SUM(bet_amount * rate) AS total FROM `bets` WHERE DATE(created_at) = CURDATE() AND status = ? AND `round` = ? GROUP BY option_id",
      ["pending", roundNumber]
    );

    if (roundQuery.length) {
      let testArr = [];

      // Collect valid option_ids that fit within payable_amount
      roundQuery.forEach((bet) => {
        if (bet.total <= payable_amount) {
          testArr.push(bet.option_id);
        }
      });

      // If no payable option is found, select an alternative set
      if (testArr.length === 0) {
        const beted_ids = roundQuery.map((item) => item.option_id);
        testArr = [1, 2, 3, 4, 5, 6, 7, 8].filter(
          (item) => !beted_ids.includes(item)
        );
      }

      // Randomly select a winning option
      const win_option = testArr.length
        ? testArr[Math.floor(Math.random() * testArr.length)]
        : [2, 3, 4, 5][Math.floor(Math.random() * 4)];

      console.log("Win option:", win_option);

      // 1. Update status of non-winning bets to "loss"
      await mysqlPool.query(
        "UPDATE `bets` SET `status` = ?, `updated_at` = ? WHERE `game_id` = ? AND `round` = ? AND `option_id` != ?",
        ["loss", new Date(), gameId, roundNumber, win_option]
      );

      // 2. Update status of winning bets to "win"
      await mysqlPool.query(
        "UPDATE `bets` SET `status` = ?, `updated_at` = ? WHERE `game_id` = ? AND `round` = ? AND `option_id` = ?",
        ["win", new Date(), gameId, roundNumber, win_option]
      );

      // 3. Store laste win option
      await mysqlPool.query(
        "INSERT INTO `win_options`(`game_id`, `option_id`, `round`, `submited`,`created_at`,`updated_at`) VALUES (?,?,?,?,?,?)",
        [
          1,
          win_option,
          roundNumber,
          testArr.length ? true : false,
          new Date(),
          new Date(),
        ]
      );
      currentObject.winOption = win_option;
      await redisClient.set("greedyObj", JSON.stringify(currentObject));
    } else {
      // If no bets were submitted, choose a random fallback win option
      currentObject.winOption = [1, 6, 7, 8][Math.floor(Math.random() * 4)];
      await redisClient.set("greedyObj", JSON.stringify(currentObject));
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

module.exports = { greedyObj };
