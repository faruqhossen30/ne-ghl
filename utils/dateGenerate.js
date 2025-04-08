const { getFirestore, Timestamp } = require("firebase-admin/firestore");



const now = new Date();
const startOfDay = new Date(now.setHours(0, 0, 0, 0)); // 00:00:00
const endOfDay = new Date(now.setHours(23, 59, 59, 999)); // 23:59:59

const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const lastDayMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);



// Convert to Firestore Timestamps
const dayStartTimestamp = Timestamp.fromDate(startOfDay);
const dayEndTimestamp = Timestamp.fromDate(endOfDay);

// Convert to Firestore Timestamps
const monthStartTimestamp = Timestamp.fromDate(firstDayMonth);
const monthEndTimestamp = Timestamp.fromDate(lastDayMonth);

module.exports = {dayStartTimestamp,dayEndTimestamp,monthStartTimestamp,monthEndTimestamp}
