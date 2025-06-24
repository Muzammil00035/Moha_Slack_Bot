const { App } = require('@slack/bolt');
require('dotenv').config();

const onboardingFlow = require('./flows/onboardingFlow');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true // 👈 Enables Socket Mode
});

onboardingFlow(app);

(async () => {
  await app.start();
  console.log('⚡️ Moha Slack bot is running with Socket Mode!');
})();