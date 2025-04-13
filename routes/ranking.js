const express = require('express');
const router = express.Router();

const { db } = require("../config/firebaseDB");
const { dayStartTimestamp, dayEndTimestamp, monthEndTimestamp, monthStartTimestamp } = require('../utils/dateGenerate');

// Helper function to get all documents with pagination
async function getAllDocuments(collectionRef, queryConstraints = []) {
  let allDocs = [];
  let lastDoc = null;
  const batchSize = 1000; // Process 1000 documents at a time

  do {
    let query = collectionRef;
    
    // Apply query constraints
    queryConstraints.forEach(constraint => {
      query = query.where(...constraint);
    });

    // Add pagination
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    query = query.limit(batchSize);

    const snapshot = await query.get();
    const docs = snapshot.docs;
    
    if (docs.length === 0) break;
    
    allDocs = allDocs.concat(docs);
    lastDoc = docs[docs.length - 1];
  } while (true);

  return allDocs;
}

router.get('/daily-earning-ranking/:id', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const collectionRef = db.collection(collectionName);
    
    const queryConstraints = [
      ["receiverId", "==", parseInt(req.params.id)],
      ["createdAt", ">=", dayStartTimestamp],
      ["createdAt", "<=", dayEndTimestamp]
    ];

    const snapshot = await getAllDocuments(collectionRef, queryConstraints);

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
      .sort((a, b) => b.totalDiamond - a.totalDiamond);

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
    const collectionRef = db.collection(collectionName);
    
    const queryConstraints = [
      ["receiverId", "==", parseInt(req.params.id)],
      ["createdAt", ">=", monthStartTimestamp],
      ["createdAt", "<=", monthEndTimestamp]
    ];

    const snapshot = await getAllDocuments(collectionRef, queryConstraints);

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
      .sort((a, b) => b.totalDiamond - a.totalDiamond);

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

router.get('/daily-sender-ranking', async (req, res) => {
  try {
    const collectionName = 'giftTransactions';
    const collectionRef = db.collection(collectionName);
    
    const queryConstraints = [
      ["createdAt", ">=", dayStartTimestamp],
      ["createdAt", "<=", dayEndTimestamp]
    ];

    const snapshot = await getAllDocuments(collectionRef, queryConstraints);

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
      .sort((a, b) => b.totalDiamond - a.totalDiamond);

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
    const collectionRef = db.collection(collectionName);
    
    const queryConstraints = [
      ["createdAt", ">=", monthStartTimestamp],
      ["createdAt", "<=", monthEndTimestamp]
    ];

    const snapshot = await getAllDocuments(collectionRef, queryConstraints);

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
      .sort((a, b) => b.totalDiamond - a.totalDiamond);

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
    const collectionRef = db.collection(collectionName);
    
    const queryConstraints = [
      ["createdAt", ">=", dayStartTimestamp],
      ["createdAt", "<=", dayEndTimestamp]
    ];

    const snapshot = await getAllDocuments(collectionRef, queryConstraints);

    const receiverTotals = {}; // Object to store total amounts and refs per receiverId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const receiverId = data.receiverId;
      const receiverRef = data.receiverRef;
      const amount = data.diamond || 0;

      if (receiverTotals[receiverId]) {
        receiverTotals[receiverId].amount += amount;
      } else {
        receiverTotals[receiverId] = {
          amount: amount,
          receiverRef: receiverRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(receiverTotals)
      .map(([receiverId, data]) => ({
        receiverId,
        receiverRef: data.receiverRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond);

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
    const collectionRef = db.collection(collectionName);
    
    const queryConstraints = [
      ["createdAt", ">=", monthStartTimestamp],
      ["createdAt", "<=", monthEndTimestamp]
    ];

    const snapshot = await getAllDocuments(collectionRef, queryConstraints);

    const receiverTotals = {}; // Object to store total amounts and refs per receiverId
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const receiverId = data.receiverId;
      const receiverRef = data.receiverRef;
      const amount = data.diamond || 0;

      if (receiverTotals[receiverId]) {
        receiverTotals[receiverId].amount += amount;
      } else {
        receiverTotals[receiverId] = {
          amount: amount,
          receiverRef: receiverRef
        };
      }
    });

    // Convert the object to an array and sort it
    let ranking = Object.entries(receiverTotals)
      .map(([receiverId, data]) => ({
        receiverId,
        receiverRef: data.receiverRef.path,
        totalDiamond: data.amount,
      }))
      .sort((a, b) => b.totalDiamond - a.totalDiamond);

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
