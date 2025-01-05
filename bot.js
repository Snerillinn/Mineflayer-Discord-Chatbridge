const mineflayer = require('mineflayer');
const axios = require('axios');
const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const mineflayerViewer = require('prismarine-viewer').mineflayer
const deathEvent = require("mineflayer-death-event")
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const discordToken = 'DiscordBotToken';
const webhookUrl = 'webhookUrl';
const deathsWebhookUrl = 'WebhookUrl2';
const minecraftServer = 'McServerIP';
const minecraftUsername = 'Username';
const chatEnabledRole = 'chat-enabled';

let bot;

function createBot() {
    bot = mineflayer.createBot({
        host: minecraftServer,
        version: 'McVersion',
        username: minecraftUsername,
        auth: 'Microsoft or cracked (offline) account',
    });

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        mineflayerViewer(bot, { port: 3000 }); // Start the viewing server on port 3000

        // Draw the path followed by the bot
        const path = [bot.entity.position.clone()];
        bot.on('move', () => {
            if (path[path.length - 1].distanceTo(bot.entity.position) > 1) {
                path.push(bot.entity.position.clone());
                bot.viewer.drawLine('path', path);
            }
        });
    });

    bot.once('spawn', () => {
        bot.chat('/login Hello123Mario123');

        bot.setControlState('forward', true);
        setTimeout(() => {
            bot.setControlState('forward', false);
            console.log(`Successfully logged into ${minecraftServer} as ${minecraftUsername}`);
        }, 6000);
    });

    bot.on('chat', async (username, message) => {
        try {
            await axios.post(webhookUrl, {
                content: message,
                username: username,
                avatar_url: `https://mineskin.eu/armor/bust/${username}/100.png`,
            });
        } catch (error) {
            console.error('Error sending message to Discord webhook:', error);
        }
    });

    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        const args = message.split(' ');
        const command = args.shift().toLowerCase();
        if (commands[command]) {
            commands[command](username, args.join(' '));
        }
    });

    bot.on('error', err => console.error('Minecraft bot error:', err));
    bot.on('end', () => {
        console.log('Bot disconnected, attempting to reconnect...');
        setTimeout(createBot, 5000); // Reconnect after 5 seconds
    });
}

createBot();

client.login(discordToken);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setPresence({ activities: [{ name: `Watching ${minecraftServer} Minecraft Chat.` }], status: 'online' });
    // Register the /say command
    const guild = client.guilds.cache.get('Discord Server'); // Replace with your guild ID
    if (guild) {
        await guild.commands.create({
            name: 'say',
            description: 'Send a message as the bot in the specified channel',
            options: [
                {
                    name: 'channel',
                    type: ApplicationCommandOptionType.Channel, // CHANNEL type
                    description: 'The channel to send the message in',
                    required: true,
                },
                {
                    name: 'message',
                    type: ApplicationCommandOptionType.String, // STRING type
                    description: 'The message to send',
                    required: true,
                },
            ],
        });
    }
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    const member = message.guild.members.cache.get(message.author.id);
    const specificChannelId = 'Channel Id';

    if (message.channel.id === specificChannelId && member.roles.cache.some(role => role.name === chatEnabledRole)) {
        const content = message.content;
        if (content.startsWith('!direct')) {
            const directMessage = content.slice(8).trim();
            bot.chat(directMessage);
        } else {
            bot.chat(`DISCORD, ${message.author.username}: ${content}`);
        }
    }
});

client.on('guildMemberAdd', member => {
    const role = member.guild.roles.cache.find(role => role.name === 'Member');
    if (role) {
        member.roles.add(role).catch(console.error);
    } else {
        console.error('Role "Member" not found');
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'say') {
        const channel = options.getChannel('channel');
        const message = options.getString('message');
        const member = interaction.guild.members.cache.get(interaction.user.id);

        if (!member.roles.cache.some(role => role.name === 'Owner')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        if (channel && message) {
            channel.send(message);
            interaction.reply({ content: 'Message sent!', ephemeral: true });
        } else {
            interaction.reply({ content: 'Invalid channel or message.', ephemeral: true });
        }
    }
});

const commands = {
    $follow: (username) => {
        if (username === bot.username) return; // Ignore commands from the bot itself
        const player = bot.players[username];
        if (!player || !player.entity) {
            bot.chat(`I can't see you, ${username}!`);
            return;
        }
        bot.chat(`Following ${username}`);
        bot.setControlState('sprint', true);
        bot.setControlState('forward', true);
        const followInterval = setInterval(() => {
            if (!player.entity) {
                bot.setControlState('sprint', false);
                bot.setControlState('forward', false);
                clearInterval(followInterval);
                bot.chat(`I lost you, ${username}!`);
                return;
            }
            bot.lookAt(player.entity.position.offset(0, player.entity.height, 0));
        }, 100);
    },
    $stopfollow: () => {
        bot.setControlState('sprint', false);
        bot.setControlState('forward', false);
        bot.chat('Stopped following.');
    },

    $stopgoto: () => {
        bot.pathfinder.setGoal(null);
        bot.chat('Stopped going to the destination.');
    },

    $come: (username) => {
        const player = bot.players[username];
        if (!player || !player.entity) {
            bot.chat(`I can't see you, ${username}!`);
            return;
        }
        bot.chat(`Coming to you, ${username}`);
        bot.pathfinder.setGoal(new GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, 1));
    },
    $say: (username, message) => {
        bot.chat(message);
    },
    $jump: () => {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 1000);
    }
};

client.on('messageCreate', message => {
    if (message.author.bot) return;

    const commandChannelId = 'Channel Id for commands';

    if (message.channel.id === commandChannelId && message.content === '!nearbyPlayers') {
        const nearbyPlayers = Object.values(bot.players)
            .filter(player => player.entity && bot.entity.position.distanceTo(player.entity.position) < 10)
            .map(player => player.username);

        if (nearbyPlayers.length > 0) {
            message.reply(`Nearby players: ${nearbyPlayers.join(', ')}`);
        } else {
            message.reply('No players nearby.');
        }
    }

    if (message.channel.id === commandChannelId && message.content.startsWith('!goto')) {
        const args = message.content.split(' ').slice(1);
        if (args.length !== 3) {
            message.reply('Please provide three coordinates. Usage: !goto <x> <y> <z>');
            return;
        }

        const [x, y, z] = args.map(Number);
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            message.reply('Coordinates must be numbers.');
            return;
        }

        message.reply(`Heading to coordinates (${x}, ${y}, ${z})`);
        const goal = new GoalNear(x, y, z, 1);
        bot.pathfinder.setGoal(goal);

        const checkArrival = setInterval(() => {
            if (bot.entity.position.distanceTo(goal) < 1) {
                message.reply('Reached destination.');
                clearInterval(checkArrival);
            }
        }, 1000);
    }

    if (message.channel.id === commandChannelId && message.content === '!coords') {
        const { x, y, z } = bot.entity.position;
        message.reply(`Current coordinates: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    }
});

bot.on('error', err => console.error('Minecraft bot error:', err));
client.on('error', err => console.error('Discord client error:', err));
