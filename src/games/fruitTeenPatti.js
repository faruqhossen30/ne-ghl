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

const selectTimeEmitUpdate = async () => {
    const redisValue = await redisClient.get("fruitTeenPattiObj");
    const currentObject = await JSON.parse(redisValue);
    const roundNumber = currentObject.round;

    // display result emit
    if (currentObject.selectTime <= 0) {
        stopSelectTimeInter();

        const fruitesTeenPattiCollectionRef = db.collection("fruitTeenPatties");
        const snapshot = await fruitesTeenPattiCollectionRef
            .where("completed", "==", false)
            .where("round", "==", roundNumber)
            .where("status", "==", "win")
            .get();
        // 2.2 winer user and win amount list
        if (!snapshot.empty) {
            try {
                let batch = db.batch();
                let winPaidUpdateBatch = db.batch();
                snapshot.forEach((doc) => {
                    const betData = doc.data();
                    winPaidUpdateBatch.update(doc.ref, {paid:true})
                    batch.update(betData.userRef, {
                        diamond: FieldValue.increment(betData.returnAmount),

                    });
                });
                await winPaidUpdateBatch.commit();
                await batch.commit();
            } catch (error) {
                console.log("2.2 error", error);
            }
        }

        // Result user status
        const items = await snapshot.docs.map((item) => {
            const betData = item.data();
            return betData;
        });

        const groupedData = await items.reduce((acc, item) => {
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

        const result = await Object.values(groupedData).sort(
            (a, b) => b.totalReturnAmount - a.totalReturnAmount
        );

        // Fetch user data from Firestore
        const userPromises = await result.map(async (item) => {
            const userDoc = await item.userRef.get();
            const userData = await userDoc.data();
            return userDoc.exists
                ? {
                    winAmount: item.totalReturnAmount,
                    name: userData.name,
                    photoURL: userData.photoURL,
                }
                : null;
        });

        const resultUsers = await Promise.all(userPromises);
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
        const coll = await db
            .collection("fruitTeenPatties")
            .where("completed", "==", false)
            .where("status", "!=", "pending");

        const sumAggregateQuery = await coll.aggregate({
            totalBetAmount: AggregateField.sum("betAmount"),
        });

        const snapshot = await sumAggregateQuery.get();
        const totalBetAmount = await snapshot.data().totalBetAmount;

        // 1.2 get total win amount
        const totalWinCollectionRef = db
            .collection("fruitTeenPatties")
            .where("completed", "==", false)
            .where("status", "==", "win");

        // Update for fix
        const sumWinAggregateQuery = await totalWinCollectionRef.aggregate({
            totalBetAmount: AggregateField.sum("returnAmount"),
        });

        const totalWinAmountSnapshot = await sumWinAggregateQuery.get();
        const totalWinAmount = await totalWinAmountSnapshot.data().totalBetAmount;

        // 1.3 calculating
        const stockAmount = totalBetAmount - totalWinAmount;
        const commissionAmount = (stockAmount / 100) * 30;
        const payableAmount = finalPayableAmount((stockAmount - commissionAmount));

        const data = {
            stockAmount: stockAmount,
            commissionAmount: commissionAmount,
            payableAmount: payableAmount,
        };

        console.log("fruitTeenPatties", data);


        // Fetch documents round bets and process for winners
        // 1.4
        const singleRoundQuery = await db
            .collection("fruitTeenPatties")
            .where("completed", "==", false)
            .where("round", "==", roundNumber)
            .get();

        // If no bets were submitted, choose a random fallback win option
        if (singleRoundQuery.empty) {
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

            console.log("Teen patti bet is empty");
        }

        // Bet some submitted, generate win option
        if (!singleRoundQuery.empty) {
            // document to json data
            const items = singleRoundQuery.docs.map((item) => {
                const itemData = item.data();
                let totalReturnAmount = item.data();
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
                

                // find and select which lower return betAmount

                // if (testArr.length === 0) {
                //     const minOption = uniqueData.reduce(
                //         (min, bet) => (bet.returnAmount < min.returnAmount ? bet : min),
                //         uniqueData[0]
                //     );
                //     testArr.push(minOption.optionId)
                // }
            }

            // Randomly select a winning option
            const win_option = (await testArr.length)
                ? testArr[Math.floor(Math.random() * testArr.length)]
                : [1, 2, 3][Math.floor(Math.random() * 3)];

            console.log("Win option:", win_option);
            currentObject.winOption = win_option;

            // 1. Update status of bets to "loss/win"
            const singleRoundQueryForUpdate = await db
                .collection("fruitTeenPatties")
                .where("completed", "==", false)
                .where("round", "==", roundNumber)
                .where("status", "==", "pending")
                .get();

            let batch = await db.batch();
            try {
                singleRoundQueryForUpdate.forEach((doc) => {
                    const docData = doc.data();
                    batch.update(doc.ref, {
                        status: docData.optionId == win_option ? "win" : "loss",
                        paid: docData.optionId == win_option ? false : true
                    });
                });
                await batch.commit();
            } catch (error) {
                console.log("1. update statsu of bets to win/loss", error);
            }
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