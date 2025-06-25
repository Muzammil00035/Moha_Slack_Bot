const { App, ExpressReceiver } = require('@slack/bolt');
require('dotenv').config();


const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

const onboardingFlow = require('./flows/onboardingFlow');

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver
});

onboardingFlow(app);
receiver.router.get('/', (req, res) => {
    res.send('✅ Moha Slack Bot is running');
});


(async () => {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Moha Slack bot is running on HTTP Events API!');
})();