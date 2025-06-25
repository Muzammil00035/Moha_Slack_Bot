module.exports = function (app) {
    const userState = {};


    const CLEANUP_INTERVAL = 1 * 60 * 60 * 1000; // 24 hours
    setInterval(() => {
        const now = Date.now();
        Object.keys(userState).forEach(userId => {
            if (userState[userId].lastActivity && 
                now - userState[userId].lastActivity > CLEANUP_INTERVAL) {
                delete userState[userId];
            }
        });
    }, CLEANUP_INTERVAL);

    function updateUserActivity(userId) {
        if (userState[userId]) {
            userState[userId].lastActivity = Date.now();
        }
    }



    const rateLimitMap = new Map();
    const RATE_LIMIT_WINDOW = 60000; // 1 minute
    const RATE_LIMIT_MAX_REQUESTS = 10;

    function checkRateLimit(userId) {
        const now = Date.now();
        const userRequests = rateLimitMap.get(userId) || [];
        
        // Remove old requests outside the window
        const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
        
        if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
            return false; // Rate limited
        }
        
        recentRequests.push(now);
        rateLimitMap.set(userId, recentRequests);
        return true;
    }


    // Utility to get DM channel for a user
    async function getDmChannel(client, userId) {
        const im = await client.conversations.open({ users: userId });
        return im.channel.id;
    }

    // Helper to send DM
    async function sendDM(client, userId, message) {
        const channel = await getDmChannel(client, userId);
        await client.chat.postMessage({ channel, ...message });
    }

    async function askNotificationPreference(user, client) {
        await sendDM(client, user, {
            text: '🔔 When should we notify you during the campaign?',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '🔹 *Step 9: Notifications*\nWhen should we notify you during the campaign?\nChoose any that apply:'
                    },
                    accessory: {
                        type: 'static_select',
                        action_id: 'notify_selected',
                        placeholder: {
                            type: 'plain_text',
                            text: 'Select one'
                        },
                        options: [
                            { text: { type: 'plain_text', text: '🗓️ Meeting booked' }, value: 'meeting' },
                            { text: { type: 'plain_text', text: '💬 Reply with interest' }, value: 'reply' },
                            { text: { type: 'plain_text', text: '📞 Call request' }, value: 'call' },
                            { text: { type: 'plain_text', text: '📌 Referral or partnership mention' }, value: 'referral' },
                            { text: { type: 'plain_text', text: '🧾 Question/request for info' }, value: 'question' },
                            { text: { type: 'plain_text', text: '📊 Add all replies to shared Google Sheet' }, value: 'sheet' },
                            { text: { type: 'plain_text', text: '💤 Don’t notify me — just run it quietly' }, value: 'quiet' }
                        ]
                    }
                }
            ]
        });
    }

    function generateIntroLine(tone, userId) {
        console.log({tone});
        
        const introLines = {
          Friendly: `Hey <@${userId}>! 😊 Hope you're having a great day! I’ll keep this short — here’s how we can help you book more appointments.`,
          Formal: `Hello <@${userId}>. I hope this message finds you well. I would like to briefly share how we can assist you in driving more appointments.`,
          Confident: `Hi <@${userId}>, I know we can bring real value to your outreach — here’s how we help you book more appointments, fast.`,
          Curious: `Hey <@${userId}>, ever wonder how companies like yours boost meetings effortlessly? Let me share how we do it.`,
          Witty: `Yo <@${userId}> — not here to waste time. Just a clever way to book more appointments with style 😉.`,
          Direct: `Hi <@${userId}>, here’s exactly how we’ll help you book more appointments. Straightforward. No fluff.`,
          Playful: `Hey <@${userId}>! 🎯 Let’s play the "Book More Appointments" game. We’ve got just the cheat code you need.`,
          Authoritative: `<@${userId}>, our system has helped hundreds streamline appointment booking. You’re next.`,
          Other: `Hey <@${userId}>! I know things get busy, so I’ll keep this short — here’s how we can help you book more appointments.`
        };
      
        return introLines[tone] || introLines['Other'];
      }
      

    app.event('team_join', async ({ event, say , client }) => {
        const user = event?.user;

        if (!checkRateLimit(user)) {
            say(`👋 Hey <@${user}>! You have used excessively this bot kindly for a minute.`);
            return;
        }
        updateUserActivity(user);
        userState[user] = { step: 'goals' };

        // sendDM(client, user, { text: '👋 Hey! I’m Moha — your AI-powered growth assistant. Let’s build your outreach campaign step by step.' });


        // await say(`👋 Hey <@${user}>! I’m Moha — your AI-powered growth assistant. Let’s build your outreach campaign step by step.`);
        await sendDM(client, user?.id,{
            text: '📌 Step 1: What’s your outreach goal?',
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: '👋 Hey! I’m Moha — your AI-powered growth assistant. Let’s build your outreach campaign step by step.' }
                },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: '📌 *Step 1:* What’s your outreach goal?\nPlease choose one option below:' },
                    accessory: {
                        type: 'static_select',
                        action_id: 'goal_selected',
                        placeholder: { type: 'plain_text', text: 'Select an option' },
                        options: [
                            { text: { type: 'plain_text', text: '📅 Book more meetings' }, value: 'meetings' },
                            { text: { type: 'plain_text', text: '📞 Get call requests' }, value: 'calls' },
                            { text: { type: 'plain_text', text: '🔁 Start warm lead pipeline' }, value: 'leads' },
                            { text: { type: 'plain_text', text: '🤝 Get referrals or partnerships' }, value: 'referrals' },
                            { text: { type: 'plain_text', text: '✍️ Other' }, value: 'other' }
                        ]
                    }
                }
            ]
        });
    });

    app.action('goal_selected', async ({ ack, body, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'goals' step
        if (!userState[user] || userState[user].step !== 'goals') return;
        const selected = body.actions[0].selected_option.value;
        if (selected === 'other') {
            userState[user].step = 'goal_other_input';
            await sendDM(client, user, { text: 'Please specify your outreach goal:' });
        } else {
            userState[user] = { goals: selected, step: 'audience' };
            await sendDM(client, user, { text: '✅ Got it!\n\n📌 Step 2: Who is your target audience?\nExample: Tech founders, coaches, agency owners, etc.' });
        }
    });

    // Handle custom goal input
    app.message(async ({ message, client }) => {
        const user = message.user;
        const text = message.text?.trim();

        if (!checkRateLimit(user)) {
            say(`👋 Hey <@${user}>! You have used excessively this bot kindly for a minute.`);
            return;
        }
        if (!userState[user]) return;

        const step = userState[user].step;

        if (step === 'goal_other_input') {
            userState[user].goals = text;
            userState[user].step = 'audience';
            await sendDM(client, user, { text: '✅ Got it!\n\n📌 Step 2: Who is your target audience?\nExample: Tech founders, coaches, agency owners, etc.' });
        }
        else if (step === 'audience') {
            userState[user].audience = text;
            userState[user].step = 'locations';
            await sendDM(client, user, { text: '✅ Noted.\n\n📌 Step 3: Where should we look for leads?\nReply with cities, states, or regions. You can separate them with commas.\nExample: California, New York, UK, Canada' });
        } else if (step === 'locations') {
            userState[user].locations = text;
            userState[user].step = 'offer';
            await sendDM(client, user, { text: '✅ Perfect.\n\n📌 Step 4: What are you offering?\nDescribe your product or service in 1-2 lines.' });
        } else if (step === 'offer') {
            userState[user].offer = text;
            userState[user].step = 'outreach_now';
            await sendDM(client, user, {
                text: '📌 Step 5: Are you currently doing outreach?',
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '📌 *Step 5:* Are you currently using any tools to do outreach?'
                        }
                    },
                    {
                        type: 'actions',
                        elements: [
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: 'Yes' },
                                value: 'yes',
                                action_id: 'outreach_yes'
                            },
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: 'No' },
                                value: 'no',
                                action_id: 'outreach_no'
                            }
                        ]
                    }
                ]
            });

        } else if (step === 'tone_other_input') {
            userState[user].tone = text;
            userState[user].step = 'tone_preview';
            const introLine = generateIntroLine(text, user);

            await sendDM(client, user, {
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `📝 *Here’s a sample intro line based on your selected  tone (${text}):*\n\n"${introLine}"`
                        }
                    },
                    {
                        type: 'actions',
                        elements: [
                            { type: 'button', text: { type: 'plain_text', text: '🔁 Change Tone' }, value: 'change_tone', action_id: 'change_tone' },
                            { type: 'button', text: { type: 'plain_text', text: '✅ Looks Good' }, value: 'tone_ok', action_id: 'tone_ok' }
                        ]
                    }
                ]
            });
        }
        
        else if (step === 'other_tool') {
            userState[user].other_tool = text;
            userState[user].step = 'crm_integration_question';
            await sendDM(client, user, {
                text: 'Would you like us to integrate with your CRM?',

                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '*Would you like us to integrate with your CRM?*'
                        }
                    },
                    {
                        type: 'actions',
                        elements: [
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: 'Yes, sync with my CRM' },
                                value: 'sync',
                                action_id: 'crm_yes'
                            },
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: 'No, use Moha’s tools' },
                                value: 'no_sync',
                                action_id: 'crm_no'
                            }
                        ]
                    }
                ]
            });
        }
        else if (step === 'signature_name') {
            userState[user].signatureData.fullName =
                text.toLowerCase() === 'default' ? userState[user].signatureData.fullName : text;
            userState[user].step = 'signature_email';
            await sendDM(client, user, {
                text: `📧 What’s your *email*? `,
                blocks: [
                    {
                        type: 'section',
                        text: { type: 'mrkdwn', text: `What's your *email*?` }
                    },
                    {
                        type: 'actions',
                        elements: [
                            { type: 'button', text: { type: 'plain_text', text: 'Default' }, value: 'default_email', action_id: 'signature_email_default' },
                            { type: 'button', text: { type: 'plain_text', text: 'Other' }, value: 'other_email', action_id: 'signature_email_other' }
                        ]
                    }
                ]
            });
        } else if (step === 'signature_email') {
            userState[user].signatureData.email =
                text.toLowerCase() === 'default' ? userState[user].signatureData.email : text;
            userState[user].step = 'signature_company';
            await sendDM(client, user, '🏢 What’s your *company name*?');
        } else if (step === 'signature_company') {
            userState[user].signatureData.company = text;
            userState[user].step = 'signature_title';
            await sendDM(client, user, '💼 What’s your *title*?');
        } else if (step === 'signature_title') {
            userState[user].signatureData.title = text;
            userState[user].step = 'signature_website';
            await sendDM(client, user, '🌐 What’s your *website or booking link*?');
        } else if (step === 'signature_website') {
            userState[user].signatureData.website = text;
            userState[user].step = 'signature_phone';
            await sendDM(client, user, {
                text: '📱 Your *phone number*?',
                blocks: [
                    {
                        type: 'section',
                        text: { type: 'mrkdwn', text: `What's your *phone number*? (optional)` }
                    },
                    {
                        type: 'actions',
                        elements: [
                            { type: 'button', text: { type: 'plain_text', text: 'Skip' }, value: 'skip_phone', action_id: 'signature_phone_skip' }
                        ]
                    }
                ]
            });
        } else if (step === 'signature_phone') {
            userState[user].signatureData.phone = text;
            userState[user].step = 'signature_linkedin';
            await sendDM(client, user, {
                text: '🔗 Your *LinkedIn or social profile*?',
                blocks: [
                    {
                        type: 'section',
                        text: { type: 'mrkdwn', text: `What's your *LinkedIn or social profile*? (optional)` }
                    },
                    {
                        type: 'actions',
                        elements: [
                            { type: 'button', text: { type: 'plain_text', text: 'Skip' }, value: 'skip_social', action_id: 'signature_social_skip' }
                        ]
                    }
                ]
            });
        } else if (step === 'signature_linkedin') {
            userState[user].signatureData.social = text;
            userState[user].step = 'signature_logo';
            await sendDM(client, user, '🖼️ Upload your *logo*');
        } else if (step === 'signature_logo') {

            const files = message.files;

            if (files && files.length > 0 && files[0].mimetype.startsWith('image/')) {
                userState[user].signatureData.logo = files[0].url_private;
                userState[user].step = 'signature_preview';

                const s = userState[user].signatureData;

                let blocks = [
                    { type: 'section', text: { type: 'mrkdwn', text: '*🖋️ Here’s your current signature preview:*' } },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `──────────────────────\n*${s.fullName}*\n${s.title}, ${s.company}\n${s.website} | ${s.phone || ''}\n${s.social ? `<${s.social}|Linkedin>` : ''}\n──────────────────────`
                        }
                    },
                    {
                        type: 'image',
                        image_url: s.logo,
                        alt_text: 'Logo Preview'
                    },
                    {
                        type: 'actions',
                        elements: [
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: '✅ Looks Good' },
                                value: 'signature_ok',
                                action_id: 'signature_ok'
                            },
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: '✏️ Edit Signature' },
                                value: 'signature_edit',
                                action_id: 'signature_edit'
                            }
                        ]
                    }
                ];

                await sendDM(client, user, { blocks });
            } else {
                await sendDM(client, user, '⚠️ Please upload a valid image file (PNG, JPG, etc.) for your logo.');
            }


        } else if (step === 'signature_name_other_input') {
            userState[user].signatureData.fullName = text;
            userState[user].step = 'signature_email';
            await sendDM(client, user, {
                text: `📧 What’s your *email*? (default: *${userState[user].signatureData.email}*)`,
                blocks: [
                    {
                        type: 'section',
                        text: { type: 'mrkdwn', text: `What's your *email*? (default: *${userState[user].signatureData.email}*)` }
                    },
                    {
                        type: 'actions',
                        elements: [
                            { type: 'button', text: { type: 'plain_text', text: 'Default' }, value: 'default_email', action_id: 'signature_email_default' },
                            { type: 'button', text: { type: 'plain_text', text: 'Other' }, value: 'other_email', action_id: 'signature_email_other' }
                        ]
                    }
                ]
            });
        } else if (step === 'signature_email_other_input') {
            userState[user].signatureData.email = text;
            userState[user].step = 'signature_company';
            await sendDM(client, user, '🏢 What’s your *company name*?');
        }

    });

    app.action('outreach_yes', async ({ ack, body, say ,client}) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'outreach_now' step
        if (!userState[user] || userState[user].step !== 'outreach_now') return;
        userState[user].step = 'select_tool';
        await sendDM(client, user, {
            text: 'Select the tool you are currently using for outreach:',
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: 'Which tool are you currently using for outreach?' },
                    accessory: {
                        type: 'static_select',
                        action_id: 'tool_selected',
                        placeholder: { type: 'plain_text', text: 'Select one' },
                        options: [
                            { text: { type: 'plain_text', text: '📧 Gmail/Outlook (manual)' }, value: 'gmail' },
                            { text: { type: 'plain_text', text: '⚡ Instantly / Smartlead' }, value: 'instantly' },
                            { text: { type: 'plain_text', text: '🔗 HubSpot' }, value: 'hubspot' },
                            { text: { type: 'plain_text', text: '📊 Salesforce' }, value: 'salesforce' },
                            { text: { type: 'plain_text', text: '🎯 Salesloft' }, value: 'salesloft' },
                            { text: { type: 'plain_text', text: '✍️ Other' }, value: 'other' }
                        ]
                    }
                }
            ]
        });
    });

    app.action('outreach_no', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'outreach_now' step
        if (!userState[user] || userState[user].step !== 'outreach_now') return;
        userState[user].outreach = 'no';
        // userState[user].step = 'complete';
        // await say(`✅ Thanks <@${user}>! That's helpful info. You're all set! 🙌`);

        userState[user].step = 'tone';
        await sendDM(client, user, {
            text: '🎨 Let’s align your outreach with your brand. What tone should we use?',
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: '*🎨 Step 6: Brand Voice*\nWhat tone should we use in your messages?' },
                    accessory: {
                        type: 'static_select',
                        action_id: 'select_tone',
                        placeholder: { type: 'plain_text', text: 'Select one' },
                        options: [
                            { text: { type: 'plain_text', text: '💬 Friendly' }, value: 'Friendly' },
                            { text: { type: 'plain_text', text: '💼 Formal' }, value: 'Formal' },
                            { text: { type: 'plain_text', text: '😎 Confident' }, value: 'Confident' },
                            { text: { type: 'plain_text', text: '🧠 Curious' }, value: 'Curious' },
                            { text: { type: 'plain_text', text: '✨ Witty' }, value: 'Witty' },
                            { text: { type: 'plain_text', text: '🎯 Direct' }, value: 'Direct' },
                            { text: { type: 'plain_text', text: '🎨 Playful' }, value: 'Playful' },
                            { text: { type: 'plain_text', text: '🧊 Authoritative' }, value: 'Authoritative' },
                            { text: { type: 'plain_text', text: '✍️ Other' }, value: 'Other' }
                        ]
                    }
                }
            ]
        });

    });

    app.action('tool_selected', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'select_tool' step
        if (!userState[user] || userState[user].step !== 'select_tool') return;
        const tool = body.actions[0].selected_option.value;
        if (tool === 'other') {
            userState[user].step = 'other_tool';
            await sendDM(client, user, 'Please specify the outreach tool you are using:');
        } else if (tool === 'hubspot' || tool === 'salesforce') {
            userState[user].selected_tool = tool;
            userState[user].step = 'crm_integration_question';
            await sendDM(client, user, {
                text: 'Would you like us to integrate with your CRM?',
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '*Would you like us to integrate with your CRM?*'
                        }
                    },
                    {
                        type: 'actions',
                        elements: [
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: 'Yes, sync with my CRM' },
                                value: 'sync',
                                action_id: 'crm_yes'
                            },
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: 'No, use Moha’s tools' },
                                value: 'no_sync',
                                action_id: 'crm_no'
                            }
                        ]
                    }
                ]
            });
        } else {
            userState[user].selected_tool = tool;
            userState[user].step = 'tone';
            await sendDM(client, user, {
                text: '🎨 Let’s align your outreach with your brand. What tone should we use?',
                blocks: [
                    {
                        type: 'section',
                        text: { type: 'mrkdwn', text: '*🎨 Step 6: Brand Voice*\nWhat tone should we use in your messages?' },
                        accessory: {
                            type: 'static_select',
                            action_id: 'select_tone',
                            placeholder: { type: 'plain_text', text: 'Select one' },
                            options: [
                                { text: { type: 'plain_text', text: '💬 Friendly' }, value: 'Friendly' },
                                { text: { type: 'plain_text', text: '💼 Formal' }, value: 'Formal' },
                                { text: { type: 'plain_text', text: '😎 Confident' }, value: 'Confident' },
                                { text: { type: 'plain_text', text: '🧠 Curious' }, value: 'Curious' },
                                { text: { type: 'plain_text', text: '✨ Witty' }, value: 'Witty' },
                                { text: { type: 'plain_text', text: '🎯 Direct' }, value: 'Direct' },
                                { text: { type: 'plain_text', text: '🎨 Playful' }, value: 'Playful' },
                                { text: { type: 'plain_text', text: '🧊 Authoritative' }, value: 'Authoritative' },
                                { text: { type: 'plain_text', text: '✍️ Other' }, value: 'Other' }
                            ]
                        }
                    }
                ]
            });
        }
    });

    app.action('crm_yes', async ({ ack, body, say , client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'crm_integration_question' step
        if (!userState[user] || userState[user].step !== 'crm_integration_question') return;
        userState[user].crm_sync = true;
        userState[user].step = 'tone';
        // userState[user].step = 'complete';
        // await say(`🔗 We’ll sync Moha with your CRM. Thank you, <@${user}>! 🙌`);


        userState[user].step = 'tone';
        await sendDM(client, user, {
            text: '🎨 Let’s align your outreach with your brand. What tone should we use?',
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: '*🎨 Step 6: Brand Voice*\nWhat tone should we use in your messages?' },
                    accessory: {
                        type: 'static_select',
                        action_id: 'select_tone',
                        placeholder: { type: 'plain_text', text: 'Select one' },
                        options: [
                            { text: { type: 'plain_text', text: '💬 Friendly' }, value: 'Friendly' },
                            { text: { type: 'plain_text', text: '💼 Formal' }, value: 'Formal' },
                            { text: { type: 'plain_text', text: '😎 Confident' }, value: 'Confident' },
                            { text: { type: 'plain_text', text: '🧠 Curious' }, value: 'Curious' },
                            { text: { type: 'plain_text', text: '✨ Witty' }, value: 'Witty' },
                            { text: { type: 'plain_text', text: '🎯 Direct' }, value: 'Direct' },
                            { text: { type: 'plain_text', text: '🎨 Playful' }, value: 'Playful' },
                            { text: { type: 'plain_text', text: '🧊 Authoritative' }, value: 'Authoritative' },
                            { text: { type: 'plain_text', text: '✍️ Other' }, value: 'Other' }
                        ]
                    }
                }
            ]
        });

    });

    app.action('crm_no', async ({ ack, body, say ,client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'crm_integration_question' step
        if (!userState[user] || userState[user].step !== 'crm_integration_question') return;
        userState[user].crm_sync = false;
        userState[user].step = 'tone';
        // userState[user].step = 'complete';
        // await say(`✅ We’ll use Moha’s built-in tools for now. Thanks, <@${user}>! 🚀`);

        userState[user].step = 'tone';
        await sendDM(client, user, {
            text: '🎨 Let’s align your outreach with your brand. What tone should we use?',
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: '*🎨 Step 6: Brand Voice*\nWhat tone should we use in your messages?' },
                    accessory: {
                        type: 'static_select',
                        action_id: 'select_tone',
                        placeholder: { type: 'plain_text', text: 'Select one' },
                        options: [
                            { text: { type: 'plain_text', text: '💬 Friendly' }, value: 'Friendly' },
                            { text: { type: 'plain_text', text: '💼 Formal' }, value: 'Formal' },
                            { text: { type: 'plain_text', text: '😎 Confident' }, value: 'Confident' },
                            { text: { type: 'plain_text', text: '🧠 Curious' }, value: 'Curious' },
                            { text: { type: 'plain_text', text: '✨ Witty' }, value: 'Witty' },
                            { text: { type: 'plain_text', text: '🎯 Direct' }, value: 'Direct' },
                            { text: { type: 'plain_text', text: '🎨 Playful' }, value: 'Playful' },
                            { text: { type: 'plain_text', text: '🧊 Authoritative' }, value: 'Authoritative' },
                            { text: { type: 'plain_text', text: '✍️ Other' }, value: 'Other' }
                        ]
                    }
                }
            ]
        });
    });


    app.action('select_tone', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'tone' step
        if (!userState[user] || userState[user].step !== 'tone') return;
        const tone = body.actions[0].selected_option.value;
        if (tone === 'Other') {
            userState[user].step = 'tone_other_input';
            await sendDM(client, user, 'Please specify the tone you want to use:');
        } else {
            userState[user].tone = tone;
            userState[user].step = 'tone_preview';
            const introLine = generateIntroLine(tone, user);

            await sendDM(client, user, {
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `📝 *Here’s a sample intro line based on your selected  tone (${tone}):*\n\n"${introLine}"`
                        }
                    },
                    {
                        type: 'actions',
                        elements: [
                            { type: 'button', text: { type: 'plain_text', text: '🔁 Change Tone' }, value: 'change_tone', action_id: 'change_tone' },
                            { type: 'button', text: { type: 'plain_text', text: '✅ Looks Good' }, value: 'tone_ok', action_id: 'tone_ok' }
                        ]
                    }
                ]
            });
        }
    });

    app.action('tone_ok', async ({ ack, body, say, client }) => {
        // await ack();
        // const user = body.user.id;
        // userState[user].step = 'signature';
        // await say('✍️ Great! Now tell me what name and title you want at the bottom of your outreach messages.\n\nExample: `Muhammad Muzammil`');

        await ack();
        const user = body.user.id;
        // Only allow if user is on 'tone_preview' step
        if (!userState[user] || userState[user].step !== 'tone_preview') return;
        const profile = await client.users.profile.get({ user });
        const realName = profile?.profile?.real_name || '';
        const email = profile?.profile?.email || '';

        userState[user].step = 'signature_name';
        userState[user].signatureData = {
            fullName: realName,
            email: email
        };

        await sendDM(client, user, {
            text: `✍️ Last thing — let’s build your email signature.\n\nWhat's your *Full Name*?`,
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `What's your *Full Name*?` }
                },
                {
                    type: 'actions',
                    elements: [
                        { type: 'button', text: { type: 'plain_text', text: 'Default' }, value: 'default_name', action_id: 'signature_name_default' },
                        { type: 'button', text: { type: 'plain_text', text: 'Other' }, value: 'other_name', action_id: 'signature_name_other' }
                    ]
                }
            ]
        });


    });

    app.action('change_tone', async ({ ack, body, say , client}) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'tone_preview' step
        if (!userState[user] || userState[user].step !== 'tone_preview') return;
        userState[user].step = 'tone';
        await sendDM(client, user, '🔁 No worries! Please select a new tone:');
        // Repeat tone button blocks or re-use same `say()` logic from above
    });

    app.action('signature_ok', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'signature_preview' step
        if (!userState[user] || userState[user].step !== 'signature_preview') return;
        userState[user].step = 'review_sequence';

        await sendDM(client, user, {
            text: '🔍 Want to review the outreach messages before we send them?',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '🔹 *Step 8: Review Sequence*\nWant to review the outreach messages before we send them?'
                    }
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: { type: 'plain_text', text: '✅ Yes, send me the draft' },
                            value: 'review_yes',
                            action_id: 'review_yes'
                        },
                        {
                            type: 'button',
                            text: { type: 'plain_text', text: '🚀 No, just go live with my inputs' },
                            value: 'review_no',
                            action_id: 'review_no'
                        }
                    ]
                }
            ]
        });

    });

    app.action('signature_edit', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'signature_preview' step
        if (!userState[user] || userState[user].step !== 'signature_preview') return;
        userState[user].step = 'signature_name';
        await sendDM(client, user, {
            text: `✏️ Let’s edit your signature. What’s your *Full Name*?`,
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `What's your *Full Name*?` }
                },
                {
                    type: 'actions',
                    elements: [
                        { type: 'button', text: { type: 'plain_text', text: 'Default' }, value: 'default_name', action_id: 'signature_name_default' },
                        { type: 'button', text: { type: 'plain_text', text: 'Other' }, value: 'other_name', action_id: 'signature_name_other' }
                    ]
                }
            ]
        });
    });

    // Signature Name Buttons
    app.action('signature_name_default', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        if (!userState[user] || userState[user].step !== 'signature_name') return;
        userState[user].step = 'signature_email';
        await sendDM(client, user, {
            text: `📧 What’s your *email*? (default: *${userState[user].signatureData.email}*)`,
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `What's your *email*?` }
                },

                {
                    type: 'actions',
                    elements: [
                        { type: 'button', text: { type: 'plain_text', text: 'Default' }, value: 'default_email', action_id: 'signature_email_default' },
                        { type: 'button', text: { type: 'plain_text', text: 'Other' }, value: 'other_email', action_id: 'signature_email_other' }
                    ]
                }
            ]
        });
    });
    app.action('signature_name_other', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        if (!userState[user] || userState[user].step !== 'signature_name') return;
        userState[user].step = 'signature_name_other_input';
        await sendDM(client, user, 'Please enter your full name:');
    });

    // Signature Email Buttons
    app.action('signature_email_default', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        if (!userState[user] || userState[user].step !== 'signature_email') return;
        userState[user].step = 'signature_company';
        await sendDM(client, user, '🏢 What’s your *company name*?');
    });
    app.action('signature_email_other', async ({ ack, body, say , client}) => {
        await ack();
        const user = body.user.id;
        if (!userState[user] || userState[user].step !== 'signature_email') return;
        userState[user].step = 'signature_email_other_input';
        await sendDM(client, user, 'Please enter your email:');
    });


    // Phone Skip Button
    app.action('signature_phone_skip', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        if (!userState[user] || userState[user].step !== 'signature_phone') return;
        userState[user].step = 'signature_linkedin';
        await sendDM(client, user, {
            text: '🔗 Your *LinkedIn or social profile*?',
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `What's your *LinkedIn or social profile*? (optional)` }
                },
                {
                    type: 'actions',
                    elements: [
                        { type: 'button', text: { type: 'plain_text', text: 'Skip' }, value: 'skip_social', action_id: 'signature_social_skip' }
                    ]
                }
            ]
        });
    });

    // Social Skip Button
    app.action('signature_social_skip', async ({ ack, body, say , client}) => {
        await ack();
        const user = body.user.id;
        if (!userState[user] || userState[user].step !== 'signature_linkedin') return;
        userState[user].step = 'signature_logo';
        await sendDM(client, user, '🖼️ Upload your *logo* ');
    });


    app.action('review_yes', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'review_sequence' step
        if (!userState[user] || userState[user].step !== 'review_sequence') return;
        userState[user].review = true;
        userState[user].step = 'notifications';

        await askNotificationPreference(user, client);
    });

    app.action('review_no', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'review_sequence' step
        if (!userState[user] || userState[user].step !== 'review_sequence') return;
        userState[user].review = false;
        userState[user].step = 'notifications';

        await askNotificationPreference(user, client);
    });


    app.action('notify_selected', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'notifications' step
        if (!userState[user] || userState[user].step !== 'notifications') return;
        const selected = body.actions[0].selected_option.value;

        userState[user].notification = selected;
        userState[user].step = 'launch_confirmation';

        const { audience, locations, offer } = userState[user];

        await sendDM(client, user, {
            text: '🚀 Final Step: Launch Confirmation',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `🔹 *Final Step: Launch Confirmation*\n\nYou’re all set!\nWe’re about to contact *${audience || 'your leads'}* in *${locations || 'target locations'}* with your offer:\n> “${offer || 'your value proposition'}”\n\nWe’ll message you here as replies come in. Want to book a kickoff call?`
                    }
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: { type: 'plain_text', text: '📞 Book Quick Call' },
                            value: 'book_call',
                            action_id: 'book_call'
                        },
                        {
                            type: 'button',
                            text: { type: 'plain_text', text: '🚀 Launch My Campaign' },
                            value: 'launch_now',
                            action_id: 'launch_now'
                        }
                    ]
                }
            ]
        });


    });


    app.action('book_call', async ({ ack, body, say, client }) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'launch_confirmation' step
        if (!userState[user] || userState[user].step !== 'launch_confirmation') return;
        userState[user].step = 'complete';

        await sendDM(client, user, `📅 Awesome! We’ll share a link to book a quick kickoff call with you, <@${user}>. Looking forward to it!`);
    });

    app.action('launch_now', async ({ ack, body, say , client}) => {
        await ack();
        const user = body.user.id;
        // Only allow if user is on 'launch_confirmation' step
        if (!userState[user] || userState[user].step !== 'launch_confirmation') return;
        userState[user].step = 'complete';

        await sendDM(client, user, `🚀 Boom! Your campaign is launching now. We’ll notify you here as results start rolling in. Let’s crush it, <@${user}>! 💥`);
    });


};