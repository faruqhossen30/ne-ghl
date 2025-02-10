const { getFirestore, Timestamp } = require("firebase-admin/firestore");

// Get today's start and end timestamps
const now = new Date();
const startOfDay = new Date(now.setHours(0, 0, 0, 0)); // Today 00:00:00
const endOfDay = new Date(now.setHours(23, 59, 59, 999)); // Today 23:59:59

// Firestore timestamps
const startTimestamp = Timestamp.fromDate(startOfDay);
const endTimestamp = Timestamp.fromDate(endOfDay);

module.exports = {startTimestamp,endTimestamp}