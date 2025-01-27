const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const redis = require("redis");

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const redisClient = redis.createClient();
const radisURL = "http://192.168.0.112:8000/6379";

const greedy = io.of("/greedy");
const luckyWheel = io.of("/lucky-wheel");

const updateValueInRedis = async () => {
    const redisValue = await redisClient.get("greedyObj");
    const currentObject = JSON.parse(redisValue);
  
    // Select time section
    if (currentObject.select) {
      if (currentObject.selectTime == 0 && currentObject.resultTime == 0) {
        clearInterval(greedyInterval);
  
        setTimeout(async () => {
          currentObject.selectTime = 0;
          currentObject.resultTime = 5;
          currentObject.select = false;
          currentObject.result = true;
          currentObject.interval = true;
          await redisClient.set("greedyObj", JSON.stringify(currentObject));
          await startInterval();
          console.log('winer select kora ses');
          
        }, 3000);
  
        console.log("select time ses calculting suru");
      }
  
  
      if (currentObject.selectTime > 0) {
        currentObject.selectTime = currentObject.selectTime - 1;
        await redisClient.set("greedyObj", JSON.stringify(currentObject)); // Update the value in Redis
        greedy.emit("game", JSON.stringify(currentObject));
      }
      console.log("select timing running", Math.floor(Math.random() * 10));
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
          await redisClient.set("greedyObj", JSON.stringify(currentObject));
          await startInterval();
          console.log('result display dekan ses');
          
        }, 3000);
        console.log("result time ses diplay show");
      }
  
      if (currentObject.resultTime > 0) {
        currentObject.resultTime = currentObject.resultTime - 1;
        await redisClient.set("greedyObj", JSON.stringify(currentObject)); // Update the value in Redis
        greedy.emit("game", JSON.stringify(currentObject));
      }
      console.log("result timing running", Math.floor(Math.random() * 10));
    }
  
    // console.log("interverl running", Math.floor(Math.random() * 10));
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
