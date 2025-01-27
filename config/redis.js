const redis = require("redis");
const redisClient = redis.createClient();
const radisURL = "http://192.168.0.112:8000/6379";

module.exports = {redisClient,radisURL};