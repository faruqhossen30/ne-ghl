const express = require('express');
const router = express.Router();


const { db } = require("../config/firebaseDB");
const { dayStartTimestamp, dayEndTimestamp, monthEndTimestamp, monthStartTimestamp } = require('../utils/dateGenerate');

router.get('/daily-earning-ranking/:id', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const snapshot = await db.collection(collectionName)
    .where("receiverId", "==", parseInt(req.params.id))
    .where("createdAt", ">=", dayStartTimestamp)
    .where("createdAt", "<=", dayEndTimestamp)
    .get();

    const senderTotals = {}; // Object to store total amounts and refs per senderId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const senderId = data.senderId;
      const senderRef = data.senderRef;
      const amount = data.diamond || 0;

      if (senderTotals[senderId]) {
        senderTotals[senderId].amount += amount;
      } else {
        senderTotals[senderId] = {
          amount: amount,
          senderRef: senderRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(senderTotals)
      .map(([senderId, data]) => ({
        senderId,
        senderRef: data.senderRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond); // Sort in descending order

    // Limit to 50 data
    ranking = ranking.slice(0, 50);

    // Add serial number
    ranking = ranking.map((item, index) => ({
      serial: index + 1,
      ...item
    }));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/monthly-earning-ranking/:id', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const snapshot = await db.collection(collectionName)
    .where("receiverId", "==", parseInt(req.params.id))
    .where("createdAt", ">=", monthStartTimestamp)
    .where("createdAt", "<=", monthEndTimestamp)
    .get();

    const senderTotals = {}; // Object to store total amounts and refs per senderId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const senderId = data.senderId;
      const senderRef = data.senderRef;
      const amount = data.diamond || 0;

      if (senderTotals[senderId]) {
        senderTotals[senderId].amount += amount;
      } else {
        senderTotals[senderId] = {
          amount: amount,
          senderRef: senderRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(senderTotals)
      .map(([senderId, data]) => ({
        senderId,
        senderRef: data.senderRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond); // Sort in descending order

    // Limit to 50 data
    ranking = ranking.slice(0, 50);

    // Add serial number
    ranking = ranking.map((item, index) => ({
      serial: index + 1,
      ...item
    }));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all documents from a collection
router.get('/daily-sender-ranking', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const snapshot = await db.collection(collectionName)
    .where("createdAt", ">=", dayStartTimestamp)
    .where("createdAt", "<=", dayEndTimestamp)
    .get();

    const senderTotals = {}; // Object to store total amounts and refs per senderId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const senderId = data.senderId;
      const senderRef = data.senderRef;
      const amount = data.diamond || 0;

      if (senderTotals[senderId]) {
        senderTotals[senderId].amount += amount;
      } else {
        senderTotals[senderId] = {
          amount: amount,
          senderRef: senderRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(senderTotals)
      .map(([senderId, data]) => ({
        senderId,
        senderRef: data.senderRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond); // Sort in descending order

    // Limit to 50 data
    ranking = ranking.slice(0, 50);

    // Add serial number
    ranking = ranking.map((item, index) => ({
      serial: index + 1,
      ...item
    }));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/monthly-sender-ranking', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const snapshot = await db.collection(collectionName)
    .where("createdAt", ">=", monthStartTimestamp)
    .where("createdAt", "<=", monthEndTimestamp)
    .get();

    const senderTotals = {}; // Object to store total amounts and refs per senderId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const senderId = data.senderId;
      const senderRef = data.senderRef;
      const amount = data.diamond || 0;

      if (senderTotals[senderId]) {
        senderTotals[senderId].amount += amount;
      } else {
        senderTotals[senderId] = {
          amount: amount,
          senderRef: senderRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(senderTotals)
      .map(([senderId, data]) => ({
        senderId,
        senderRef: data.senderRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond); // Sort in descending order

    // Limit to 50 data
    ranking = ranking.slice(0, 50);

    // Add serial number
    ranking = ranking.map((item, index) => ({
      serial: index + 1,
      ...item
    }));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/daily-receiver-ranking', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const snapshot = await db.collection(collectionName)
    .where("createdAt", ">=", dayStartTimestamp)
    .where("createdAt", "<=", dayEndTimestamp)
    .get();

    const senderTotals = {}; // Object to store total amounts and refs per senderId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const receiverId = data.receiverId;
      const receiverRef = data.receiverRef;
      const amount = data.diamond || 0;

      if (senderTotals[receiverId]) {
        senderTotals[receiverId].amount += amount;
      } else {
        senderTotals[receiverId] = {
          amount: amount,
          receiverRef: receiverRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(senderTotals)
      .map(([receiverId, data]) => ({
        receiverId,
        receiverRef: data.receiverRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond); // Sort in descending order

    // Limit to 50 data
    ranking = ranking.slice(0, 50);

    // Add serial number
    ranking = ranking.map((item, index) => ({
      serial: index + 1,
      ...item
    }));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/monthly-receiver-ranking', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const snapshot = await db.collection(collectionName)
    .where("createdAt", ">=", monthStartTimestamp)
    .where("createdAt", "<=", monthEndTimestamp)
    .get();

    const senderTotals = {}; // Object to store total amounts and refs per senderId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const receiverId = data.receiverId;
      const receiverRef = data.receiverRef;
      const amount = data.diamond || 0;

      if (senderTotals[receiverId]) {
        senderTotals[receiverId].amount += amount;
      } else {
        senderTotals[receiverId] = {
          amount: amount,
          receiverRef: receiverRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(senderTotals)
      .map(([receiverId, data]) => ({
        receiverId,
        receiverRef: data.receiverRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond); // Sort in descending order

    // Limit to 50 data
    ranking = ranking.slice(0, 50);

    // Add serial number
    ranking = ranking.map((item, index) => ({
      serial: index + 1,
      ...item
    }));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;
