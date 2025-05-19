// const mysql = require("mysql2");
// const { FieldValue, AggregateField, FieldPath } = require("firebase-admin/firestore");
// const { clearInterval } = require("timers");
// const { redisClient } = require("../../config/redis");
// const { io } = require("../../config/socket");
// const { db } = require("../../config/firebaseDB");
// const gameOptiondData = require("../../data/greedyOptions");
// const { startTimestamp, endTimestamp } = require("../../utils/dateGenerate");
// const { finalPayableAmount } = require("../../utils/amountCalculation");

// const crypto = require('crypto');

// // Constants
// const NAMESPACE = '/greedy';
// const DEFAULT_SELECT_TIME = 15;
// const RESULT_DISPLAY_TIME = 2000;
// const WIN_CALCULATION_DELAY = 2000;
// const COMMISSION_PERCENTAGE = 30;
// const FALLBACK_WIN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
// const greedyWinRecourds = [1, 2, 3, 4, 5, 6, 7, 8];

// const greedy = io.of(NAMESPACE);

// // Initial game state
// const greedyObj = {
//   selectTime: DEFAULT_SELECT_TIME,
//   winOption: 0,
//   round: 1,
// };

// let selectTimeInterval;

// // Helper Functions
// const updateWinRecords = async (winOption) => {
//   try {
//     const redisWinRecords = await redisClient.get("greedyWinRecourds");
//     const winRecordsArr = JSON.parse(redisWinRecords);
//     winRecordsArr.unshift(winOption);
//     winRecordsArr.pop();
//     await redisClient.set("greedyWinRecourds", JSON.stringify(winRecordsArr));
//   } catch (error) {
//     console.error("Error updating win records:", error);
//   }
// };

// const processWinners = async (roundNumber) => {
//   try {
//     const greediesRef = db.collection("greedies");
//     const BATCH_SIZE = 500; // Firestore batch limit
//     const PAGE_SIZE = 1000; // Safe size for pagination
//     let lastDoc = null;
//     const userMap = new Map();

//     // Process winners in pages
//     while (true) {
//       // Optimized query with proper ordering
//       let query = greediesRef
//         .where("round", "==", roundNumber)  // Most selective filter first
//         .where("status", "==", "win")       // Second most selective
//         .where("completed", "==", false)    // Least selective last
//         .orderBy(FieldPath.documentId());   // For pagination

//       if (lastDoc) {
//         query = query.startAfter(lastDoc);
//       }

//       const winSnapshot = await query.limit(PAGE_SIZE).get();
//       if (winSnapshot.empty) break;

//       // Process documents in batches
//       const documents = winSnapshot.docs;
//       for (let i = 0; i < documents.length; i += BATCH_SIZE) {
//         const batch = db.batch();
//         const betBatch = db.batch();
//         const chunk = documents.slice(i, i + BATCH_SIZE);

//         chunk.forEach((doc) => {
//           const betData = doc.data();
//           betBatch.update(doc.ref, { paid: true });
//           batch.update(betData.userRef, {
//             diamond: FieldValue.increment(betData.returnAmount),
//           });

//           // Group winner data
//           const userId = betData.userId;
//           if (!userMap.has(userId)) {
//             userMap.set(userId, {
//               userId,
//               userRef: betData.userRef,
//               count: 0,
//               totalReturnAmount: 0,
//             });
//           }
//           const userStats = userMap.get(userId);
//           userStats.count += 1;
//           userStats.totalReturnAmount += betData.returnAmount;
//         });

//         await Promise.all([batch.commit(), betBatch.commit()]);
//       }

//       lastDoc = documents[documents.length - 1];
//     }

//     // Sort winners by total return amount
//     const sortedWinners = Array.from(userMap.values())
//       .sort((a, b) => b.totalReturnAmount - a.totalReturnAmount);

//     // Fetch user details in parallel with a reasonable batch size
//     const BATCH_USER_DETAILS = 50;
//     const userDetails = [];
//     for (let i = 0; i < sortedWinners.length; i += BATCH_USER_DETAILS) {
//       const chunk = sortedWinners.slice(i, i + BATCH_USER_DETAILS);
//       const chunkDetails = await Promise.all(
//         chunk.map(async (item) => {
//           const userDoc = await item.userRef.get();
//           const userData = userDoc.data();
//           return userDoc.exists ? {
//             winAmount: item.totalReturnAmount,
//             name: userData.name,
//             photoURL: userData.photoURL,
//           } : null;
//         })
//       );
//       userDetails.push(...chunkDetails.filter(Boolean));
//     }

//     return userDetails;
//   } catch (error) {
//     console.error("Error processing winners:", error);
//     return [];
//   }
// };

// const calculateGameMetrics = async () => {
//   try {
//     const greediesRef = db.collection("greedies");
//     const BATCH_SIZE = 10000; // Firestore's aggregation limit
//     let totalBetAmount = 0;
//     let totalWinAmount = 0;
//     let lastBetDoc = null;
//     let lastWinDoc = null;

//     // Process bet amounts in batches
//     while (true) {
//       let betQuery = greediesRef
//         .where("completed", "==", false)
//         .where("status", "!=", "pending");

//       if (lastBetDoc) {
//         betQuery = betQuery.startAfter(lastBetDoc);
//       }

//       const betSnapshot = await betQuery.limit(BATCH_SIZE).get();
//       if (betSnapshot.empty) break;

//       const batchBetAmount = betSnapshot.docs.reduce((sum, doc) => {
//         return sum + (doc.data().betAmount || 0);
//       }, 0);

//       totalBetAmount += batchBetAmount;
//       lastBetDoc = betSnapshot.docs[betSnapshot.docs.length - 1];
//     }

//     // Process win amounts in batches
//     while (true) {
//       let winQuery = greediesRef
//         .where("completed", "==", false)
//         .where("status", "==", "win");

//       if (lastWinDoc) {
//         winQuery = winQuery.startAfter(lastWinDoc);
//       }

//       const winSnapshot = await winQuery.limit(BATCH_SIZE).get();
//       if (winSnapshot.empty) break;

//       const batchWinAmount = winSnapshot.docs.reduce((sum, doc) => {
//         return sum + (doc.data().returnAmount || 0);
//       }, 0);

//       totalWinAmount += batchWinAmount;
//       lastWinDoc = winSnapshot.docs[winSnapshot.docs.length - 1];
//     }

//     const stockAmount = totalBetAmount - totalWinAmount;
//     const commissionAmount = (stockAmount * COMMISSION_PERCENTAGE) / 100;
    
//     console.log('payable', finalPayableAmount((stockAmount - commissionAmount)));
    
//     return {
//       stockAmount,
//       commissionAmount,
//       payableAmount: finalPayableAmount((stockAmount - commissionAmount))
//     };
//   } catch (error) {
//     console.error("Error calculating game metrics:", error);
//     return { stockAmount: 0, commissionAmount: 0, payableAmount: 0 };
//   }
// };

// // Helper function for secure random number generation
// const getSecureRandomNumber = (max) => {
//   const randomBytes = crypto.randomBytes(4);
//   const randomNumber = randomBytes.readUInt32BE(0);
//   return Math.floor((randomNumber / 0xffffffff) * max);
// };

// const determineWinOption = async (roundNumber, payableAmount) => {
//   try {
//     const greediesRef = db.collection("greedies");
//     const BATCH_SIZE = 10000; // Firestore's limit
//     let lastDoc = null;
//     const optionTotals = {};
//     let totalBets = 0;

//     // Process bets in batches
//     while (true) {
//       let query = greediesRef
//         .where("completed", "==", false)
//         .where("round", "==", roundNumber);

//       if (lastDoc) {
//         query = query.startAfter(lastDoc);
//       }

//       const roundBets = await query.limit(BATCH_SIZE).get();
      
//       if (roundBets.empty) {
//         break;
//       }

//       // Process current batch
//       roundBets.docs.forEach(doc => {
//         const bet = doc.data();
//         if (!optionTotals[bet.optionId]) {
//           optionTotals[bet.optionId] = { total: 0 };
//         }
//         optionTotals[bet.optionId].total += bet.returnAmount;
//         totalBets++;
//       });

//       lastDoc = roundBets.docs[roundBets.docs.length - 1];
//     }

//     // If no bets found, return random fallback option
//     if (totalBets === 0) {
//       return FALLBACK_WIN_OPTIONS[getSecureRandomNumber(FALLBACK_WIN_OPTIONS.length)];
//     }

//     const payableOptions = Object.entries(optionTotals)
//       .filter(([_, data]) => data.total <= payableAmount)
//       .map(([optionId]) => parseInt(optionId));

//     if (payableOptions.length === 0) {
//       const betedIds = Object.keys(optionTotals).map(Number);
//       const fallbackOption = FALLBACK_WIN_OPTIONS.filter(id => !betedIds.includes(id))[0];

//       if (fallbackOption) {
//         return fallbackOption;
//       }
      
//       // If no fallback option is available, find the option with minimum return amount
//       let minOption = null;
//       let minAmount = Infinity;
      
//       for (const [optionId, data] of Object.entries(optionTotals)) {
//         if (data.total < minAmount) {
//           minAmount = data.total;
//           minOption = parseInt(optionId);
//         }
//       }
      
//       return minOption || FALLBACK_WIN_OPTIONS[getSecureRandomNumber(FALLBACK_WIN_OPTIONS.length)];
//     }

//     return payableOptions[getSecureRandomNumber(payableOptions.length)];
//   } catch (error) {
//     console.error("Error determining win option:", error);
//     return FALLBACK_WIN_OPTIONS[getSecureRandomNumber(FALLBACK_WIN_OPTIONS.length)];
//   }
// };

// const selectTimeEmitUpdate = async () => {
//   try {
//     const redisValue = await redisClient.get("greedyObj");
//     const currentObject = JSON.parse(redisValue);
//     const roundNumber = currentObject.round;

//     if (currentObject.selectTime <= 0) {
//       await handleGameEnd(currentObject, roundNumber);
//     } else if (currentObject.selectTime === 6) {
//       await handleWinCalculation(currentObject, roundNumber);
//     } else {
//       currentObject.selectTime -= 1;
//       await redisClient.set("greedyObj", JSON.stringify(currentObject));
//       greedy.emit("game", JSON.stringify(currentObject));
//     }
//   } catch (error) {
//     console.error("Error in selectTimeEmitUpdate:", error);
//   }
// };

// const handleGameEnd = async (currentObject, roundNumber) => {
//   stopSelectTimeInter();
  
//   const resultUsers = await processWinners(roundNumber);
//   const winRecords = JSON.parse(await redisClient.get("greedyWinRecourds"));

//   greedy.emit("result", {
//     data: JSON.stringify(currentObject),
//     resultUsers,
//     winRecords,
//   });

//   // Reset for next round
//   currentObject.selectTime = 30;
//   currentObject.winOption = 0;
//   currentObject.round += 1;
//   await redisClient.set("greedyObj", JSON.stringify(currentObject));
  
//   setTimeout(startSelectTimeInterval, RESULT_DISPLAY_TIME);
// };

// const handleWinCalculation = async (currentObject, roundNumber) => {
//   stopSelectTimeInter();
//   currentObject.selectTime -= 1;

//   const metrics = await calculateGameMetrics();
//   const winOption = await determineWinOption(roundNumber, metrics.payableAmount);
//   currentObject.winOption = winOption;

//   // Update bet statuses with pagination and batching
//   const BATCH_SIZE = 500; // Firestore batch limit
//   const PAGE_SIZE = 1000; // Safe size for pagination
//   let lastDoc = null;

//   while (true) {
//     let query = db.collection("greedies")
//       .where("completed", "==", false)
//       .where("round", "==", roundNumber)
//       .where("status", "==", "pending")
//       .orderBy(FieldPath.documentId()); // For pagination

//     if (lastDoc) {
//       query = query.startAfter(lastDoc);
//     }

//     const pendingBets = await query.limit(PAGE_SIZE).get();
//     if (pendingBets.empty) break;

//     // Process documents in batches
//     const documents = pendingBets.docs;
//     for (let i = 0; i < documents.length; i += BATCH_SIZE) {
//       const batch = db.batch();
//       const chunk = documents.slice(i, i + BATCH_SIZE);

//       chunk.forEach(doc => {
//         const betData = doc.data();
//         batch.update(doc.ref, {
//           status: betData.optionId === winOption ? "win" : "loss",
//           paid: betData.optionId === winOption ? false : true,
//         });
//       });

//       await batch.commit();
//     }

//     lastDoc = documents[documents.length - 1];
//   }

//   await updateWinRecords(winOption);
//   await redisClient.set("greedyObj", JSON.stringify(currentObject));
//   greedy.emit("game", JSON.stringify(currentObject));

//   setTimeout(startSelectTimeInterval, WIN_CALCULATION_DELAY);
// };

// const stopSelectTimeInter = () => clearInterval(selectTimeInterval);
// const startSelectTimeInterval = () => {
//   selectTimeInterval = setInterval(selectTimeEmitUpdate, 1000);
// };

// // Socket.io setup
// greedy.on("connection", (socket) => {
//   console.log("User connected to greedy game");
  
//   socket.on("disconnect", () => {
//     console.log("User disconnected from greedy game");
//   });

//   redisClient.get("count").then((value) => {
//     socket.emit("game", value);
//   });
// });

// // Initialize game interval
// selectTimeInterval = setInterval(selectTimeEmitUpdate, 1000);

// module.exports = { greedyObj,greedyWinRecourds };
