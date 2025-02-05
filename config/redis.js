const redis = require("redis");
const redisClient = redis.createClient();
const radisURL = `${process.env.APP_URL}/6379`;

module.exports = {redisClient,radisURL};