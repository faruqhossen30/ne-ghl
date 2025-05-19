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
// const { greedyObj, greedyWinRecourds } = require("./src/games/greedy");
const { fruitTeenPattiObj, fruitTeenPattiWinRecourds } = require("./src/games/fruitTeenPatti");
const greddyGenerateWInPtion = require("./utils/greedyGenerateWinOption");
const { db } = require("./config/firebaseDB");
const { startTimestamp, endTimestamp } = require("./utils/dateGenerate");

const newRoutes = require("./routes/ranking");
const fcmRoutes = require("./routes/fcm");
// const { teenPattiObj, teenPattiWinRecourds } = require("./src/games/teenPatti");

// Games File
// require("./src/games/greedy");

// Express Middleware
app.set("view engine", "ejs");
app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api', newRoutes);
app.use('/api/fcm/', fcmRoutes);

app.get("/", async (req, res) => {
  res.send('welcome to hompage');
});


app.get("/query", async (req, res) => {
  res.send('weclome');
});

app.get("/test", async (req, res) => {
  res.send("serveris working");
});

server.listen(3000, async () => {
  await redisClient.connect(radisURL).then(() => {
    console.log("redis connect");
  });

  // For Greedy Game

  // await redisClient.set("greedyObj", JSON.stringify(greedyObj));
  // await redisClient.set("greedyWinRecourds", JSON.stringify(greedyWinRecourds));

  // For Fruits Teen Patti Game

  await redisClient.set("fruitTeenPattiObj", JSON.stringify(fruitTeenPattiObj));
  await redisClient.set("fruitTeenPattiWinRecourds", JSON.stringify(fruitTeenPattiWinRecourds));

  // For Teen Patti Game
  // await redisClient.set("teenPattiObj", JSON.stringify(teenPattiObj));
  // await redisClient.set("teenPattiWinRecourds", JSON.stringify(teenPattiWinRecourds));



  console.log(`server running ${process.env.APP_URL}`);
});
