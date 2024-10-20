const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

// Create an express app
const app = express();

// Define the path for the data file (data.json)
const dataFile = path.join(__dirname, 'data.json');

// Initialize an empty object to store user data
let userData = {};

// Function to load the data from data.json
function loadData() {
    try {
        console.log("Attempting to load data from:", dataFile);  // Debug log the file path
        const data = fs.readFileSync(dataFile, 'utf8');
        userData = JSON.parse(data);
        console.log("Data loaded successfully.");
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("Data file not found, creating a new one...");
        } else if (error instanceof SyntaxError) {
            console.error("Invalid JSON in data file:", error);
        }
        console.log("Initializing empty data.");
        userData = {};  // Initialize empty data if the file is missing or contains invalid JSON

        // Create a new data file with empty JSON
        fs.writeFileSync(dataFile, JSON.stringify(userData, null, 2), 'utf8');
    }
}

// Function to save data to data.json
function saveData() {
    try {
        console.log("Saving data to:", dataFile);  // Debug log the file path
        fs.writeFileSync(dataFile, JSON.stringify(userData, null, 2), 'utf8');
        console.log("Data saved successfully.");
    } catch (error) {
        console.error("Error saving data:", error);
    }
}

// Set up your bot with necessary intents (make sure you have enabled the right intents in the Discord Developer Portal)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,  // To track voice state changes (joins, leaves)
    ],
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    loadData();  // Load the data when the bot starts
});

// Function to calculate the time spent in hours, minutes, and seconds
function convertMillisToTime(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return { hours, minutes, seconds };
}

// Handle users joining and leaving voice channels
client.on('voiceStateUpdate', (oldState, newState) => {
    const userID = newState.member.user.id;
    const guildID = newState.guild.id;
    
    // Create user data object if it doesn't exist for this user
    if (!userData[guildID]) {
        userData[guildID] = {};
    }
    if (!userData[guildID][userID]) {
        userData[guildID][userID] = {
            daily: 0,
            weekly: 0,
            monthly: 0,
            lastJoinTime: null,
        };
    }

    // Get the current timestamp
    const currentTime = Date.now();

    // Handle when a user joins a voice channel
    if (newState.channel && !oldState.channel) {
        console.log(`${newState.member.user.tag} joined the channel: ${newState.channel.name}`);
        userData[guildID][userID].lastJoinTime = currentTime;
    }

    // Handle when a user leaves a voice channel
    if (!newState.channel && oldState.channel) {
        console.log(`${newState.member.user.tag} left the channel: ${oldState.channel.name}`);
        
        // Calculate the time spent in the channel
        const timeSpent = currentTime - userData[guildID][userID].lastJoinTime;

        // Convert timeSpent from milliseconds to hours, minutes, and seconds
        const { hours, minutes, seconds } = convertMillisToTime(timeSpent);

        // Add the time to daily, weekly, and monthly totals (in hours)
        const totalTimeInHours = hours + minutes / 60 + seconds / 3600;
        userData[guildID][userID].daily += totalTimeInHours;
        userData[guildID][userID].weekly += totalTimeInHours;
        userData[guildID][userID].monthly += totalTimeInHours;

        saveData();  // Save data after each update
    }
});

// Command handling
client.on('messageCreate', message => {
    if (message.author.bot) return;  // Ignore bot messages

    const prefix = "-";  // Your command prefix
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Command to display help text
    if (command === 'help') {
        message.channel.send(`Here are the available commands:\n${prefix}ping - Responds with pong.\n${prefix}d - Displays today's study hours.\n${prefix}w - Displays this week's study hours.\n${prefix}m - Displays this month's study hours.`);
    }

    // Command to display daily study hours for all users
    if (command === 'd') {
        const guildID = message.guild.id;

        if (userData[guildID]) {
            let leaderboard = Object.keys(userData[guildID])
                .map(userID => {
                    const userHours = userData[guildID][userID].daily;
                    const { hours, minutes, seconds } = convertMillisToTime(userHours * 60 * 60 * 1000);  // Convert to milliseconds
                    return {
                        user: client.users.cache.get(userID),
                        hours,
                        minutes,
                        seconds
                    };
                })
                .sort((a, b) => b.hours - a.hours || b.minutes - a.minutes || b.seconds - a.seconds);  // Sort by hours, minutes, and seconds

            const leaderboardMessage = leaderboard.map((entry, index) => {
                return `${index + 1}. ${entry.user.tag}: ${entry.hours} hours ${entry.minutes} minutes ${entry.seconds} seconds`;
            }).join("\n");

            message.channel.send(`Here are today's study hours:\n${leaderboardMessage}`);
        } else {
            message.channel.send("No study data available.");
        }
    }

    // Command to display weekly study hours for all users
    if (command === 'w') {
        const guildID = message.guild.id;

        if (userData[guildID]) {
            let leaderboard = Object.keys(userData[guildID])
                .map(userID => {
                    const userHours = userData[guildID][userID].weekly;
                    const { hours, minutes, seconds } = convertMillisToTime(userHours * 60 * 60 * 1000);  // Convert to milliseconds
                    return {
                        user: client.users.cache.get(userID),
                        hours,
                        minutes,
                        seconds
                    };
                })
                .sort((a, b) => b.hours - a.hours || b.minutes - a.minutes || b.seconds - a.seconds);  // Sort by hours, minutes, and seconds

            const leaderboardMessage = leaderboard.map((entry, index) => {
                return `${index + 1}. ${entry.user.tag}: ${entry.hours} hours ${entry.minutes} minutes ${entry.seconds} seconds`;
            }).join("\n");

            message.channel.send(`Here are this week's study hours:\n${leaderboardMessage}`);
        } else {
            message.channel.send("No study data available.");
        }
    }

    // Command to display monthly study hours for all users
    if (command === 'm') {
        const guildID = message.guild.id;

        if (userData[guildID]) {
            let leaderboard = Object.keys(userData[guildID])
                .map(userID => {
                    const userHours = userData[guildID][userID].monthly;
                    const { hours, minutes, seconds } = convertMillisToTime(userHours * 60 * 60 * 1000);  // Convert to milliseconds
                    return {
                        user: client.users.cache.get(userID),
                        hours,
                        minutes,
                        seconds
                    };
                })
                .sort((a, b) => b.hours - a.hours || b.minutes - a.minutes || b.seconds - a.seconds);  // Sort by hours, minutes, and seconds

            const leaderboardMessage = leaderboard.map((entry, index) => {
                return `${index + 1}. ${entry.user.tag}: ${entry.hours} hours ${entry.minutes} minutes ${entry.seconds} seconds`;
            }).join("\n");

            message.channel.send(`Here are this month's study hours:\n${leaderboardMessage}`);
        } else {
            message.channel.send("No study data available.");
        }
    }
});

// Create a simple endpoint for UptimeRobot to ping
app.get('/', (req, res) => {
    res.send('Bot is running');
});

// Set the bot to listen for HTTP requests on port 3000
app.listen(3000, () => {
    console.log('Bot is running on port 3000');
});

// Log in to Discord
client.login(process.env.BOT_TOKEN);
