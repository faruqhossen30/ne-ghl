const { Timestamp } = require("firebase-admin/firestore");
const moment = require("moment-timezone");

// Define timezone
const TIMEZONE = "Asia/Dhaka"; // UTC+6 (Bangladesh). Change if you want a different UTC+6 region

// Current time in UTC+6
const now = moment().tz(TIMEZONE);

// Start and end of the day in UTC+6
const startOfDay = now.clone().startOf('day');
const endOfDay = now.clone().endOf('day');

// Start and end of the current month in UTC+6
const startOfMonth = now.clone().startOf('month');
const endOfMonth = now.clone().endOf('month');

// Convert to Firestore Timestamps
const dayStartTimestamp = Timestamp.fromDate(startOfDay.toDate());
const dayEndTimestamp = Timestamp.fromDate(endOfDay.toDate());
const monthStartTimestamp = Timestamp.fromDate(startOfMonth.toDate());
const monthEndTimestamp = Timestamp.fromDate(endOfMonth.toDate());

module.exports = {
  dayStartTimestamp,
  dayEndTimestamp,
  monthStartTimestamp,
  monthEndTimestamp
};
