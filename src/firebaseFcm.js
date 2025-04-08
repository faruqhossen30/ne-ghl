const { admin, db } = require("../config/firebaseDB");
let token = "cVzqw-8cSwae41F-ERgLk3:APA91bGM0lVIAnaHKLTIluwXzVTCBoLUpnmqOTvwZdpWALpurLzZ0p761t46RVxMLZcp1x2bwRHcLDGL6DfQJOKMl7xzQpgtoj4mt3IMPwjKh9e8bawvw9c";

// Function to send a message to a single device
async function sendMessageToSingleDevice(token, title, subtitle) {
  const message = {
    token: token,
    notification: {
      title: title,
      body: subtitle,
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
      },
    },
    data: {},
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Function to send a message to multiple devices
async function sendMessageToMultipleDevices() {

  const message = {
    notification: {
      title: "this is title",
      body: "this is body",
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
      },
    },
    data: {},
    tokens: [
      token,
      "eejR9dWWQHqhfTOl_DL3ph:APA91bEw7l0gNhqQGP1d6s8OT_l5jX5dYu0ycMLNN9CzLChLa-CDwMlz21a6g_n2gs-k5NBW_PlBqyd5IviKfjfh2eSKzZ3_n0FNGAhYlAfUWhtHhNxGGB0"
    ],
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent to ${response.successCount} devices, failed: ${response.failureCount}`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          // console.error(`Failed token [${tokens[idx]}]:`, resp.error);
        }
      });
    }

    return response;
  } catch (error) {
    console.error('Error sending multicast message:', error);
    throw error;
  }
}

async function sendMessageForGoLive(uid) {


  try {
    const userRef = db.collection('users').doc(uid);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.data();

    const followersRef = db.collection('users').doc(uid).collection('followers');

    const snapshot = await followersRef.get();

    if (snapshot.empty) {
      console.log('No following documents found.');
      return;
    }

    const fcmTokens = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userRef = data.userRef;

      if (userRef && userRef.get) {
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          const userData = userSnap.data();
          if (userData.fcmToken) {
            fcmTokens.push(userData.fcmToken);
          } else {
            console.log(`No fcmToken in ${userRef.path}`);
          }
        } else {
          console.log(`Referenced user document ${userRef.path} does not exist.`);
        }
      } else {
        console.log(`Invalid or missing userRef in doc ${doc.id}`);
      }
    }

    const message = {
      notification: {
        title: `${userData.name} is live now!`,
        body: "Join and enjoy live.",
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
      data: {},
      tokens: fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent to ${response.successCount} devices, failed: ${response.failureCount}`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          // console.error(`Failed token [${tokens[idx]}]:`, resp.error);
        }
      });
    }

    // return response;
  } catch (error) {
    console.error('Error sending multicast message:', error);
    throw error;
  }
}

module.exports = {
  sendMessageToSingleDevice,
  sendMessageToMultipleDevices,
  sendMessageForGoLive
};
