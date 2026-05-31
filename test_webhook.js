require('dotenv').config();
const crypto = require('crypto');
const appSecret = process.env.FACEBOOK_APP_SECRET || '';

const payload = {
  object: "page",
  entry: [
    {
      id: "123456",
      time: Date.now(),
      changes: [
        {
          value: {
            from: { id: "987", name: "Ngân Trần" },
            item: "comment",
            post_id: "123_456",
            verb: "add",
            message: "Hello webhook realtime testing!"
          },
          field: "feed"
        }
      ]
    }
  ]
};

const body = JSON.stringify(payload);
const signature = `sha256=${crypto.createHmac('sha256', appSecret).update(body).digest('hex')}`;

fetch('http://localhost:3001/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-hub-signature-256': signature
  },
  body: body
}).then(res => res.text()).then(text => console.log('Response:', text)).catch(err => console.error(err));