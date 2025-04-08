const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');


const { db } = require("../config/firebaseDB");
const { sendMessageToSingleDevice, sendMessageToMultipleDevices, sendMessageForGoLive } = require('../src/firebaseFcm');

router.post('/send-to-single',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('subtitle').notEmpty().withMessage('subtitle is required')
  ],
  async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation error',
        details: errors.array()
      });
    }
    const {token, title, subtitle} = req.body;

    try {
      const response = await sendMessageToSingleDevice(token,title, subtitle);
      res.status(200).json({ message: 'Message sent successfully', response });

    } catch (error) {
      res.status(500).json({ error: 'Failed to send message', details: error.message });
      console.log('this is error');
      console.log(error);
    }
  }
);


router.get('/golive/:uid', async (req, res) => {
  try {
    const response = await sendMessageForGoLive(req.params.uid);
    res.status(200).json({ message: 'Go live sent successfully'});
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});


module.exports = router;
