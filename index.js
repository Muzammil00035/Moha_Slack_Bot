const { App } = require('@slack/bolt');
require('dotenv').config();

const onboardingFlow = require('./flows/onboardingFlow');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

onboardingFlow(app);

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Moha Slack bot is running on HTTP Events API!');
})();