const mysql = require("mysql2");
const { clearInterval } = require("timers");
const { redisClient } = require("../../config/redis");
const { io } = require("../../config/socket");
const { mysqlPool } = require("../../config/db");
const { db } = require("../../config/firebaseDB");
const { FieldValue } = require("firebase-admin/firestore");

const luckyWheel = io.of("/luckywheel");

// Lucky Wheel start 152 - 247
const luckyWheelObj = {
  selectTime: 5,
  resultTime: 0,
  select: true,
  result: false,
  interval: true,
};

const luckyWheelUpdateValueInRedis = async () => {
  const redisValue = await redisClient.get("luckyWheelObj");
  const currentObject = JSON.parse(redisValue);

  // Select time section
  if (currentObject.select) {
    if (currentObject.selectTime == 0 && currentObject.resultTime == 0) {
      clearInterval(luckyWheelInterval);

      setTimeout(async () => {
        currentObject.selectTime = 0;
        currentObject.resultTime = 5;
        currentObject.select = false;
        currentObject.result = true;
        currentObject.interval = true;
        await redisClient.set("luckyWheelObj", JSON.stringify(currentObject));
        await startLuckyWheelInterval();
        // console.log('luckywheel winer select kora ses');
      }, 3000);

      // console.log("luckywheel select time ses calculting suru");
    }

    if (currentObject.selectTime > 0) {
      currentObject.selectTime = currentObject.selectTime - 1;
      await redisClient.set("luckyWheelObj", JSON.stringify(currentObject)); // Update the value in Redis
      luckyWheel.emit("game", JSON.stringify(currentObject));
    }
    // console.log("luckywheel select timing running", Math.floor(Math.random() * 5));
  }

  // Result time section
  if (currentObject.result) {
    if (currentObject.selectTime == 0 && currentObject.resultTime == 0) {
      clearInterval(luckyWheelInterval);

      setTimeout(async () => {
        currentObject.selectTime = 5;
        currentObject.resultTime = 0;
        currentObject.select = true;
        currentObject.result = false;
        currentObject.interval = true;
        await redisClient.set("luckyWheelObj", JSON.stringify(currentObject));
        await startLuckyWheelInterval();
        // console.log('luckywheel result display dekan ses');
      }, 3000);

      // console.log("luckywheel result time ses diplay show");
    }

    if (currentObject.resultTime > 0) {
      currentObject.resultTime = currentObject.resultTime - 1;
      await redisClient.set("luckyWheelObj", JSON.stringify(currentObject)); // Update the value in Redis
      luckyWheel.emit("game", JSON.stringify(currentObject));
    }
    // console.log("luckywheel result timing running", Math.floor(Math.random() * 5));
  }

  // console.log("interverl running", Math.floor(Math.random() * 5));
};

let luckyWheelInterval = setInterval(luckyWheelUpdateValueInRedis, 1000);

async function startLuckyWheelInterval() {
  luckyWheelInterval = setInterval(luckyWheelUpdateValueInRedis, 1000);
}

// Socket.io setup
luckyWheel.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

  // Send the current value to the newly connected client
  redisClient.get("count").then((value) => {
    socket.emit("game", value);
  });
});

// Lucky Wheel End
module.exports = {luckyWheelObj}