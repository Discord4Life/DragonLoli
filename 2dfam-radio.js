global.Promise = require('bluebird');

const Discord = require('discord.js');
const { oneLine, stripIndents } = require('common-tags');
const path = require('path');
const sqlite = require('sqlite');
const WebSocket = require('ws');
const winston = require('winston');
const request = require('superagent');

const config = require('./config');
const Guilds = require('./Guilds');

const client = new Discord.Client({
	disableEveryone: true,
	messageCacheMaxSize: 1
});

let guilds;
let listeners = 0;
let radioJSON;
let ws;
let streaming = false;

sqlite.open(path.join(__dirname, 'settings.db')).then(db => guilds = new Guilds(db, client)); // eslint-disable-line no-return-assign

function connectWS(info) {
	if (ws) ws.removeAllListeners();
	try {
		ws = new WebSocket(info);
		winston.info('WEBSOCKET: Connection A-OK!');
	} catch (error) {
		setTimeout(() => { return connectWS(info); }, 3000);
		winston.warn('WEBSOCKET: Couldn\'t connect, reconnecting...');
	}

	ws.on('message', data => {
		try {
			if (data) radioJSON = JSON.parse(data);
		} catch (error) {
			winston.error(error);
		}
	});
	ws.on('close', () => {
		setTimeout(() => { return connectWS(info); }, 3000);
		winston.warn('WEBSOCKET: Connection closed, reconnecting...');
	});
	ws.on('error', winston.error);
}

function currentUsersAndGuildsGame() {
	client.user.setGame(`for ${listeners} on ${client.guilds.size} servers`);
	
	return setTimeout(TouchingAndrew, 20000);
}

function TouchingAndrew() {
	client.user.setGame(`with Andrew`);
	
	return setTimeout(currentUsersAndGuildsGame, 500);
}

client.on('error', winston.error)
	.on('warn', winston.warn)
	.on('ready', () => {
		winston.info(oneLine`
			CLIENT: 2DFam Radio is ready!
			${client.user.username}#${client.user.discriminator} (ID: ${client.user.id})
			Currently in ${client.guilds.size} servers.
		`);
		guilds.startup();
		connectWS(config.streamInfo);
		currentUsersAndGuildsGame();
	})
	.on('disconnect', () => {
		winston.warn('CLIENT: Disconnected!');
		clearInterval(streamCheck);
		guilds.destroy();
		process.exit(1);
	})
	.on('guildCreate', guild => {
		return guild.defaultChannel.sendEmbed({
			description: stripIndents`**2DFam Radio - discord bot by Crawl**

					**Usage:**
					After adding me to your server, join a voice channel and type \`2D!join\` to bind me to that voice channel.
					Keep in mind that you need to have the \`Manage Server\` permission to use this command.

					**Commands:**
					**\ toodee!join**: Joins the voice channel you are currently in.
					**\ toodee!leave**: Leaves the voice channel the bot is currently in.
					
					**2DFam Radio:**
					W: http://community.2dfam.com/radio/
					T: http://twitter.com/2DFam_Radio
					
					You can also download our apps, more information here: http://radio.2dfam.com/#apps
					
					**[Add me to your server](https://discordapp.com/oauth2/authorize?&client_id=276790073163513856&scope=bot&permissions=36702208)**
					
					-

					Check out the [github](https://github.com/GoNovaVFX/2DFam-Radio-Bot) rep.`,

			color: 15473237
		});
	})
	.on('guildDelete', guild => { guilds.clear(guild.id); })
	/* eslint-disable consistent-return */
	.on('message', msg => { // eslint-disable-line complexity
		if (msg.channel.type === 'dm') return;
		if (msg.author.bot) return;
		const prefix = guilds.get(msg.guild.id, 'prefix', 'toodee!');

		if (!msg.content.startsWith(prefix)) return;

		const permission = msg.channel.permissionsFor(msg.client.user);
		if (!permission || !permission.hasPermission('SEND_MESSAGES')) return;

		const ignored = guilds.get(msg.guild.id, 'ignore', []);
		const manageGuild = msg.member.hasPermission('MANAGE_GUILD');
		if (!config.owners.includes(msg.author.id) && !manageGuild && ignored.includes(msg.channel.id)) return;

		const message = msg.content.toLowerCase();

		if (message.startsWith(`${prefix}join`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				if (msg.author.id === '83700966167150592') {
					return msg.channel.sendMessage('I won\'t do that, tawake. （｀Δ´）！');
				}

				return msg.reply('only a member with manage guild permission can add me to a voice channel, gomen! <(￢0￢)>');
			}

			if (client.voiceConnections.get(msg.guild.id)) {
				return msg.reply('I am already in a voice channel here, baka! ｡゜(｀Д´)゜｡');
			}

			if (!msg.member.voiceChannel) {
				return msg.reply('you have to be in a voice channel to add me, baka! ｡゜(｀Д´)゜｡');
			}

			const voiceChannel = msg.guild.channels.get(msg.member.voiceChannel.id);

			guilds.set(msg.guild.id, 'voiceChannel', voiceChannel.id);
			guilds.joinVoice(msg.guild, voiceChannel);
			return msg.channel.sendMessage(`Streaming to your server now, ${msg.author}-san! (* ^ ω ^)`);
		} else if (message.startsWith(`${prefix}leave`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				if (msg.author.id === '83700966167150592') {
					return msg.channel.sendMessage('I won\'t do that, tawake. （｀Δ´）！');
				}

				return msg.reply('only a member with manage guild permission can remove me from a voice channel, gomen! <(￢0￢)>');
			}

			if (!client.voiceConnections.get(msg.guild.id)) {
				return msg.reply('you didn\'t add me to a voice channel yet, baka! ｡゜(｀Д´)゜｡');
			}

			if (!msg.member.voiceChannel) {
				return msg.reply('you have to be in a voice channel to remove me, baka! ｡゜(｀Д´)゜｡');
			}

			const voiceChannel = client.voiceConnections.get(msg.guild.id);

			guilds.remove(msg.guild.id, 'voiceChannel');
			guilds.leaveVoice(msg.guild, voiceChannel);
			return msg.channel.sendMessage(`I will stop streaming to your server now, ${msg.author}-san. (-ω-、)`);
		} else if (message.startsWith(`${prefix}help`)) {
			return msg.channel.sendEmbed({
				description: stripIndents`**2DFam Radio**

					**Usage:**
					After adding me to your server, join a voice channel and type \`2D!join\` to bind me to that voice channel.
					Keep in mind that you need to have the \`Manage Server\` permission to use this command.

					**Commands:**
					**\ toodee!join**: Joins the voice channel you are currently in.
					**\ toodee!leave**: Leaves the voice channel the bot is currently in.
					
					**2DFam Radio:**
					W: http://community.2dfam.com/radio/
					T: http://twitter.com/2DFam_Radio
					
					You can also download our apps, more information here: http://radio.2dfam.com/#apps
					
					**[Add me to your server](https://discordapp.com/oauth2/authorize?&client_id=276790073163513856&scope=bot&permissions=36702208)**
					
					-

					Check out the [github](https://github.com/GoNovaVFX/2DFam-Radio-Bot) rep.`,
				color: 15473237
			});
		} else if (message.startsWith(`${prefix}eval`)) {
			if (!config.owners.includes(msg.author.id)) {
				return msg.channel.sendMessage('Only the Botowners can eval, gomen! <(￢0￢)>');
			}

			let result;
			try {
				winston.info(`EVAL: ${msg.content.substr(prefix.length + 5)} FROM ${msg.author.username}`);
				result = eval(msg.content.substr(prefix.length + 5));
			} catch (error) {
				result = error;
			}

			return msg.channel.sendCode('javascript', result, { split: true });
		} else if (message.startsWith(`${prefix}prefix`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				if (msg.author.id === '83700966167150592') {
					return msg.channel.sendMessage('I won\'t do that, tawake. （｀Δ´）！');
				}

				return msg.reply('only a member with manage guild permission can change my prefix, gomen! <(￢0￢)>');
			}

			if (msg.content === `${prefix}prefix default`) {
				winston.info(`PREFIX RESET: "~~" ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				guilds.remove(msg.guild.id, 'prefix');
				return msg.channel.sendMessage(`Prefix resetted to \`~~\` (⌒_⌒;)`);
			}

			if (/[a-zA-Z0-9\s\n]/.test(msg.content.substr(prefix.length + 7))) {
				return msg.channel.sendMessage('Prefix can\'t be a letter, number, or whitespace character, gomen! <(￢0￢)>');
			}

			winston.info(`PREFIX CHANGE: "${msg.content.substr(prefix.length + 7)}" ON GUILD ${msg.guild.name} (${msg.guild.id})`);
			guilds.set(msg.guild.id, 'prefix', msg.content.substr(prefix.length + 7));
			return msg.channel.sendMessage(`Prefix changed to \`${msg.content.substr(prefix.length + 7)}\` (⌒_⌒;)`);
		} else if (message.startsWith(`${prefix}ignore`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				return msg.reply('only a member with manage guild permission can change ignored channels, gomen! <(￢0￢)>');
			}

			if (msg.content === `${prefix}ignore all`) {
				const channels = msg.guild.channels;

				winston.info(`CHANNEL IGNORE: All channels ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				for (const [key] of channels) ignored.push(key);
				guilds.set(msg.guild.id, 'ignore', ignored);
				return msg.reply('gotcha! I\'m going to ignore all channels now. (￣▽￣)');
			}

			if (ignored.includes(msg.channel.id)) {
				return msg.reply('this channel is already on the ignore list, baka! ｡゜(｀Д´)゜｡');
			}

			ignored.push(msg.channel.id);

			winston.info(`CHANNEL IGNORE: (${msg.channel.id}) ON GUILD ${msg.guild.name} (${msg.guild.id})`);
			guilds.set(msg.guild.id, 'ignore', ignored);
			return msg.reply('gotcha! I\'m going to ignore this channel now. (￣▽￣)');
		} else if (message.startsWith(`${prefix}unignore`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				return msg.reply('only a member with manage guild permission can change ignored channels, gomen! <(￢0￢)>');
			}

			if (typeof ignored === 'undefined') {
				return msg.reply('there are  no channels on the ignore list, gomen! <(￢0￢)>');
			}

			if (msg.content === `${prefix}unignore all`) {
				winston.info(`CHANNEL UNIGNORE: All channels ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				guilds.remove(msg.guild.id, 'ignore');
				return msg.reply('gotcha! I\'m baaack!  ＼(≧▽≦)／ (not going to ignore any channels anymore).');
			}

			if (!ignored.includes(msg.channel.id)) {
				return msg.reply('this channel isn\'t on the ignore list, gomen! <(￢0￢)>');
			}

			if (ignored.length === 1) {
				winston.info(`CHANNEL UNIGNORE: (${msg.channel.id}) ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				guilds.remove(msg.guild.id, 'ignore');
				return msg.reply('gotcha! I\'m baaack!  ＼(≧▽≦)／ (not going to ignore this channel anymore).');
			}

			const findIgnored = ignored.indexOf(msg.channel.id);

			if (findIgnored > -1) {
				ignored.splice(findIgnored, 1);
			}

			winston.info(`CHANNEL UNIGNORE: (${msg.channel.id}) ON GUILD ${msg.guild.name} (${msg.guild.id})`);
			guilds.set(msg.guild.id, 'ignore', ignored);
			return msg.reply('I\'m baaack!  ＼(≧▽≦)／ (not going to ignore this channel anymore).');
		}
	});

client.login(config.token);

process.on('unhandledRejection', err => {
	winston.error(`Uncaught Promise Error:\n${err.stack}`);
});
