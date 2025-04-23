const { FieldValue, AggregateField } = require("firebase-admin/firestore");
const { clearInterval } = require("timers");
const { redisClient } = require("../../config/redis");
const { io } = require("../../config/socket");
const { db } = require("../../config/firebaseDB");
const { startTimestamp, endTimestamp } = require("../../utils/dateGenerate");
const { finalPayableAmount } = require("../../utils/amountCalculation");

const fruitTeenPattiIO = io.of("/fruitteenpatti");

const fruitTeenPattiObj = {
    selectTime: 15,
    winOption: 0,
    round: 1,
};
const fruitTeenPattiWinRecourds = [1, 2, 3, 1, 2, 3, 1, 2];

// Helper function to get all documents from a collection with pagination
async function getAllDocumentsWithPagination(query, batchSize = 500) {
    let allDocs = [];
    let lastDoc = null;
    let hasMore = true;
    
    while (hasMore) {
        let currentQuery = query;
        
        if (lastDoc) {
            currentQuery = query.startAfter(lastDoc);
        }
        
        const snapshot = await currentQuery.limit(batchSize).get();
        
        if (snapshot.empty) {
            hasMore = false;
            break;
        }
        
        allDocs = allDocs.concat(snapshot.docs);
        
        if (snapshot.docs.length < batchSize) {
            hasMore = false;
        } else {
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
        }
    }
    
    return allDocs;
}

// Helper function to process documents in batches
async function processDocumentsInBatches(docs, batchSize = 500, processFunction) {
    const results = [];
    
    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const batchResults = await processFunction(batch);
        
        // Handle both array and non-array results
        if (Array.isArray(batchResults)) {
            results.push(...batchResults);
        } else if (batchResults !== undefined && batchResults !== null) {
            results.push(batchResults);
        }
    }
    
    return results;
}

const selectTimeEmitUpdate = async () => {
    const redisValue = await redisClient.get("fruitTeenPattiObj");
    const currentObject = await JSON.parse(redisValue);
    const roundNumber = currentObject.round;

    // display result emit
    if (currentObject.selectTime <= 0) {
        stopSelectTimeInter();

        const fruitesTeenPattiCollectionRef = db.collection("fruitTeenPatties");
        const query = fruitesTeenPattiCollectionRef
            .where("completed", "==", false)
            .where("round", "==", roundNumber)
            .where("status", "==", "win");
            
        // Use pagination to get all documents
        const snapshot = await getAllDocumentsWithPagination(query);
        
        // 2.2 winer user and win amount list
        if (snapshot.length > 0) {
            try {
                // Process documents in batches to avoid hitting Firestore limits
                await processDocumentsInBatches(snapshot, 500, async (batchDocs) => {
                    let batch = db.batch();
                    let winPaidUpdateBatch = db.batch();
                    
                    batchDocs.forEach((doc) => {
                        const betData = doc.data();
                        winPaidUpdateBatch.update(doc.ref, {paid: true});
                        batch.update(betData.userRef, {
                            diamond: FieldValue.increment(betData.returnAmount),
                        });
                    });
                    
                    await winPaidUpdateBatch.commit();
                    await batch.commit();
                });
            } catch (error) {
                console.log("2.2 error", error);
            }
        }

        // Result user status
        const items = snapshot.map((item) => {
            const betData = item.data();
            return betData;
        });

        const groupedData = items.reduce((acc, item) => {
            if (!acc[item.userId]) {
                acc[item.userId] = {
                    userId: item.userId,
                    userRef: item.userRef,
                    count: 0,
                    totalReturnAmount: 0,
                };
            }
            acc[item.userId].count += 1;
            acc[item.userId].totalReturnAmount += item.returnAmount;
            return acc;
        }, {});

        const result = Object.values(groupedData).sort(
            (a, b) => b.totalReturnAmount - a.totalReturnAmount
        );

        // Fetch user data from Firestore in batches
        const userPromises = await processDocumentsInBatches(result, 100, async (batchItems) => {
            return Promise.all(batchItems.map(async (item) => {
                const userDoc = await item.userRef.get();
                const userData = userDoc.data();
                return userDoc.exists
                    ? {
                        winAmount: item.totalReturnAmount,
                        name: userData.name,
                        photoURL: userData.photoURL,
                    }
                    : null;
            }));
        });

        const resultUsers = userPromises.flat().filter(Boolean);
        // result user end

        const redisWinRecords = await redisClient.get("fruitTeenPattiWinRecourds");
        const winRecords = await JSON.parse(redisWinRecords);


        fruitTeenPattiIO.emit("result", {
            data: JSON.stringify(currentObject),
            resultUsers: resultUsers ?? [],
            winRecords: winRecords,
        });

        currentObject.selectTime = 30;
        currentObject.winOption = 0;
        currentObject.round = currentObject.round + 1;
        await redisClient.set("fruitTeenPattiObj", JSON.stringify(currentObject));
        setTimeout(async () => {
            startSelectTimeInterval();
        }, 5000);
    } else if (currentObject.selectTime == 6) {
        stopSelectTimeInter();
        currentObject.selectTime = currentObject.selectTime - 1;

        // 1.1 get total beted amount
        const coll = db
            .collection("fruitTeenPatties")
            .where("completed", "==", false)
            .where("status", "!=", "pending");

        const sumAggregateQuery = coll.aggregate({
            totalBetAmount: AggregateField.sum("betAmount"),
        });

        const snapshot = await sumAggregateQuery.get();
        const totalBetAmount = snapshot.data().totalBetAmount || 0;

        // 1.2 get total win amount
        const totalWinCollectionRef = db
            .collection("fruitTeenPatties")
            .where("completed", "==", false)
            .where("status", "==", "win");

        // Update for fix
        const sumWinAggregateQuery = totalWinCollectionRef.aggregate({
            totalBetAmount: AggregateField.sum("returnAmount"),
        });

        const totalWinAmountSnapshot = await sumWinAggregateQuery.get();
        const totalWinAmount = totalWinAmountSnapshot.data().totalBetAmount || 0;

        // 1.3 calculating
        const stockAmount = totalBetAmount - totalWinAmount;
        const commissionAmount = (stockAmount / 100) * 30;
        const payableAmount = finalPayableAmount((stockAmount - commissionAmount));

        const data = {
            stockAmount: stockAmount,
            commissionAmount: commissionAmount,
            payableAmount: payableAmount,
        };

        // Fetch documents round bets and process for winners
        // 1.4 - using pagination for large collections
        const singleRoundQuery = db
            .collection("fruitTeenPatties")
            .where("completed", "==", false)
            .where("round", "==", roundNumber);
            
        const roundDocs = await getAllDocumentsWithPagination(singleRoundQuery);

        // If no bets were submitted, choose a random fallback win option
        if (roundDocs.length === 0) {
            const win_option = [1, 2, 3][
                Math.floor(Math.random() * 3)
            ];
            currentObject.winOption = win_option;

            // for generate winrecourd option
            const redisWinRecords = await redisClient.get("fruitTeenPattiWinRecourds");
            const redisWinRecordsArr = await JSON.parse(redisWinRecords);
            await redisWinRecordsArr.unshift(win_option);
            await redisWinRecordsArr.pop();
            await redisClient.set(
                "fruitTeenPattiWinRecourds",
                JSON.stringify(redisWinRecordsArr)
            );
        }

        // Bet some submitted, generate win option
        if (roundDocs.length > 0) {
            // document to json data
            const items = roundDocs.map((item) => {
                const itemData = item.data();
                return {
                    id: item.id,
                    round: itemData.round,
                    optionId: itemData.optionId,
                    betAmount: itemData.betAmount,
                    rate: itemData.rate,
                    returnAmount: itemData.betAmount * itemData.rate,
                };
            });
            // Json data to unique with groupby data
            const uniqueData = Object.values(
                items.reduce((acc, item) => {
                    if (!acc[item.optionId]) {
                        acc[item.optionId] = { ...item, total: 0 };
                    }
                    acc[item.optionId].total += item.betAmount * item.rate;
                    return acc;
                }, {})
            );

            // Collect valid optionId that fit within payableAmount
            let testArr = [];
            uniqueData.forEach((bet) => {
                if (bet.total < payableAmount) {
                    testArr.push(bet.optionId);
                }
            });

            // If no payable option is found, select an which is not beted / unbeted option id
            if (testArr.length === 0) {
                // find and select unbeted optionid
                console.log('not found payable optioid');
                
                // if not found unbeted optionid
                const betedIds = uniqueData.map((item) => item.optionId);
                testArr = [1, 2, 3].filter(
                    (item) => !betedIds.includes(item)
                );
            }

            // Randomly select a winning option
            const win_option = testArr.length
                ? testArr[Math.floor(Math.random() * testArr.length)]
                : [1, 2, 3][Math.floor(Math.random() * 3)];

            console.log("Win option:", win_option);
            currentObject.winOption = win_option;

            // 1. Update status of bets to "loss/win" - using pagination
            const singleRoundQueryForUpdate = db
                .collection("fruitTeenPatties")
                .where("completed", "==", false)
                .where("round", "==", roundNumber)
                .where("status", "==", "pending");
                
            const updateDocs = await getAllDocumentsWithPagination(singleRoundQueryForUpdate);
            
            // Process updates in batches
            await processDocumentsInBatches(updateDocs, 500, async (batchDocs) => {
                let batch = db.batch();
                
                batchDocs.forEach((doc) => {
                    const docData = doc.data();
                    batch.update(doc.ref, {
                        status: docData.optionId == win_option ? "win" : "loss",
                        paid: docData.optionId == win_option ? false : true
                    });
                });
                
                await batch.commit();
            });
            
            // for generate winrecourd option
            const redisWinRecords = await redisClient.get("fruitTeenPattiWinRecourds");
            const redisWinRecordsArr = await JSON.parse(redisWinRecords);
            await redisWinRecordsArr.unshift(win_option);
            await redisWinRecordsArr.pop();
            await redisClient.set(
                "fruitTeenPattiWinRecourds",
                JSON.stringify(redisWinRecordsArr)
            );
        }

        await redisClient.set("fruitTeenPattiObj", JSON.stringify(currentObject));
        fruitTeenPattiIO.emit("game", JSON.stringify(currentObject));

        setTimeout(async () => {
            // Start result
            // Winder option
            startSelectTimeInterval();
        }, 1500);
    } else {
        currentObject.selectTime = currentObject.selectTime - 1;
        await redisClient.set("fruitTeenPattiObj", JSON.stringify(currentObject));
        fruitTeenPattiIO.emit("game", JSON.stringify(currentObject));
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

fruitTeenPattiIO.on("connection", (socket) => {
    console.log("A user connected");
    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });

    socket.on('hit', (data) => {
        // console.log('Message from Flutter:', data);
        fruitTeenPattiIO.emit('fruitTeenPattiRemoteHit', { option: data.option, amount: data.amount });
    });

});

module.exports = { fruitTeenPattiObj, fruitTeenPattiWinRecourds };