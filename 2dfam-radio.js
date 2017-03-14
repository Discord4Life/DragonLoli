global.Promise = require('bluebird');

const Discord = require('discord.js');
const oneLine = require('common-tags').oneLine;
const path = require('path');
const Raven = require('raven');
const sqlite = require('sqlite');
const stripIndents = require('common-tags').stripIndents;
const WebSocket = require('ws');
const winston = require('winston');

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

sqlite.open(path.join(__dirname, 'settings.db')).then(db => guilds = new Guilds(db, client)); // eslint-disable-line no-return-assign

// Raven.config(config.ravenKey);
// .install();

function connectWS(info) {
	if (ws) ws.removeAllListeners();
	try {
		ws = new WebSocket(info);
		winston.info('WEBSOCKET: Connection A-OK!');
	} catch (error) {
		setTimeout(() => { connectWS(info); }, 3000);
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
		setTimeout(() => { connectWS(info); }, 3000);
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

setInterval(() => {
	try {
		listeners = client.voiceConnections
			.map(vc => vc.channel.members.filter(me => !(me.user.bot || me.selfDeaf || me.deaf)).size)
			.reduce((sum, members) => sum + members);
	} catch (error) {
		listeners = 0;
	}
}, 30000);

client.on('error', winston.error)
	.on('warn', winston.warn)
	.on('ready', () => {
		winston.info(oneLine`
			CLIENT: Listen.moe ready!
			${client.user.username}#${client.user.discriminator} (ID: ${client.user.id})
			Currently in ${client.guilds.size} servers.
		`);
		guilds.startup();
		currentUsersAndGuildsGame();
	})
	.on('disconnect', () => { winston.warn('CLIENT: Disconnected!'); })
	.on('reconnect', () => { winston.warn('CLIENT: Reconnecting...'); })
	.on('guildDelete', guild => { guilds.clear(guild.id); })
	.on('message', msg => {
		if (msg.channel.type === 'dm') return;
		if (msg.author.bot) return;
		const prefix = guilds.get(msg.guild.id, 'prefix', 'toodee!');

		if (!msg.content.startsWith(prefix)) return;

		const permission = msg.channel.permissionsFor(msg.client.user);
		if (!permission.hasPermission('SEND_MESSAGES')) return;

		const ignored = guilds.get(msg.guild.id, 'ignore', []);
		const manageGuild = msg.member.hasPermission('MANAGE_GUILD');
		if (!config.owners.includes(msg.author.id) && !manageGuild && ignored.includes(msg.channel.id)) return;

		const message = msg.content.toLowerCase();

		if (message.startsWith(`${prefix}join`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				msg.reply('Only a member with manage guild permission can add me to a voice channel!');
				return;
			}

			if (client.voiceConnections.get(msg.guild.id)) {
				msg.reply('the AESTHETICS is already playing in a channel!');
				return;
			}

			if (!msg.member.voiceChannel) {
				msg.reply('you have to be in a voice channel to let the AESTHETICS join your channel.');
				return;
			}

			const voiceChannel = msg.guild.channels.get(msg.member.voiceChannel.id);

			guilds.set(msg.guild.id, 'voiceChannel', voiceChannel.id);
			guilds.joinVoice(msg.guild, voiceChannel);
			msg.channel.sendMessage(`Streaming to your server now, ${msg.author}`);
		} else if (message.startsWith(`${prefix}leave`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				msg.reply('only a member with manage guild permission can remove the AESTHETICS from a voice channel.');
				return;
			}

			if (!client.voiceConnections.get(msg.guild.id)) {
				msg.reply('you didn\'t add the AESTHETICS to a voice channel yet.');
				return;
			}

			if (!msg.member.voiceChannel) {
				msg.reply('you have to be in a voice channel to remove the AESTHETICS.');
				return;
			}

			const voiceChannel = client.voiceConnections.get(msg.guild.id);

			guilds.set(msg.guild.id, 'voiceChannel');
			guilds.leaveVoice(msg.guild, voiceChannel);
			msg.channel.sendMessage(`I will stop streaming to your server now, ${msg.author}-san. (-ω-、)`);
		} else if (message.startsWith(`${prefix}stats`)) {
			if (!config.owners.includes(msg.author.id)) {
				msg.channel.sendMessage('Only @Andrew.#6465  and @GoNova#5508  can view the bot stats!');
				return;
			}

			let users;
			try {
				users = client.voiceConnections
					.map(vc => vc.channel.members.filter(me => !(me.user.bot || me.selfDeaf || me.deaf)).size)
					.reduce((sum, members) => sum + members);
			} catch (error) {
				users = 0;
			}

			const nowplaying = `${radioJSON.artist_name ? `${radioJSON.artist_name} - ` : ''}${radioJSON.song_name}`;
			const anime = radioJSON.anime_name ? `Anime: ${radioJSON.anime_name}` : '';
			const requestedBy = radioJSON.requested_by ? `Requested by: [${radioJSON.requested_by}](https://forum.listen.moe/u/${radioJSON.requested_by})` : '';
			const song = `${nowplaying}\n\n${anime}\n${requestedBy}`;

			msg.channel.sendEmbed({
				color: 15473237,
				author: {
					url: 'http://community.2dfam.com/radio/',
					name: '2D FM'
				},
				title: 'Website',
				url: 'http://community.2dfam.com/radio/',
				fields: [
					{ name: 'Discord Listeners', value: users, inline: true },
					{ name: 'Servers', value: client.guilds.size, inline: true },
					{ name: 'Voice Channels', value: client.voiceConnections.size, inline: true }
				],
				timestamp: new Date(),
				thumbnail: { url: 'https://images.discordapp.net/avatars/241241955600695296/3c4beb1712bd97d69903678e055adc83.png?size=1024' }
			});
		} else if (message.startsWith(`${prefix}help`)) {
			msg.channel.sendEmbed({
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
					
					An Android app is avalible, please visit the website for information and download. iOS coming soon.
					
					**[Add me to your server](https://discordapp.com/oauth2/authorize?&client_id=276790073163513856&scope=bot&permissions=36702208)**
					
					-

					This bot is based of LISTEN.moe, please visit the [Github](https://github.com/WeebDev/listen.moe-discord) rep.`,
				color: 15473237
			});
		//} else if (message.startsWith(`${prefix}np`)) {
		//	const nowplaying = `${radioJSON.artist_name ? `${radioJSON.artist_name} - ` : ''}${radioJSON.song_name}`;
		//	const anime = radioJSON.anime_name ? `Anime: ${radioJSON.anime_name}` : '';
		//	const requestedBy = radioJSON.requested_by ? `Requested by: [${radioJSON.requested_by}](https://forum.listen.moe/u/${radioJSON.requested_by})` : '';
		//	const song = `${nowplaying}\n\n${anime}\n${requestedBy}`;

		//	msg.channel.sendEmbed({
		//		color: 15473237,
		//		fields: [
		//			{ name: 'Now playing', value: song }
		//		]
		//	});
		} else if (message.startsWith(`${prefix}eval`)) {
			if (!config.owners.includes(msg.author.id)) {
				msg.channel.sendMessage('Only @GoNova#5508 and @Andrew.#6465 can eval!');
				return;
			}

			let result;
			try {
				winston.info(`EVAL: ${msg.content.substr(prefix.length + 5)} FROM ${msg.author.username}`);
				result = eval(msg.content.substr(prefix.length + 5));
			} catch (error) {
				result = error;
			}

			msg.channel.sendCode('javascript', result, { split: true });
		} else if (message.startsWith(`${prefix}prefix`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				msg.reply('only a member with manage guild permission can change my prefix!');
				return;
			}

			if (msg.content === `${prefix}prefix default`) {
				winston.info(`PREFIX RESET: "toodee!" ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				guilds.remove(msg.guild.id, 'prefix');
				msg.channel.sendMessage(`Prefix resetted to \`~~\` (⌒_⌒;)`);
				return;
			}

			if (/[a-zA-Z0-9\s\n]/.test(msg.content.substr(prefix.length + 7))) {
				msg.channel.sendMessage('Prefix can\'t be a letter, number, or whitespace character/');
				return;
			}

			winston.info(`PREFIX CHANGE: "${msg.content.substr(prefix.length + 7)}" ON GUILD ${msg.guild.name} (${msg.guild.id})`);
			guilds.set(msg.guild.id, 'prefix', msg.content.substr(prefix.length + 7));
			msg.channel.sendMessage(`Prefix changed to \`${msg.content.substr(prefix.length + 7)}\` (⌒_⌒;)`);
		} else if (message.startsWith(`${prefix}ignore`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				msg.reply('only a member with manage guild permission can change ignored channels.');
				return;
			}

			if (msg.content === `${prefix}ignore all`) {
				const channels = msg.guild.channels;

				winston.info(`CHANNEL IGNORE: All channels ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				for (const [key] of channels) ignored.push(key);
				guilds.set(msg.guild.id, 'ignore', ignored);
				msg.reply('gotcha! I\'m going to ignore all channels now. (￣▽￣)');
				return;
			}

			if (ignored.includes(msg.channel.id)) {
				msg.reply('this channel is already on the ignore list! ｡゜(｀Д´)゜｡');
				return;
			}

			ignored.push(msg.channel.id);

			winston.info(`CHANNEL IGNORE: (${msg.channel.id}) ON GUILD ${msg.guild.name} (${msg.guild.id})`);
			guilds.set(msg.guild.id, 'ignore', ignored);
			msg.reply('gotcha! I\'m going to ignore this channel now. (￣▽￣)');
		} else if (message.startsWith(`${prefix}unignore`)) {
			if (!config.owners.includes(msg.author.id) && !manageGuild) {
				msg.reply('only a member with manage guild permission can change ignored channels!');
				return;
			}

			if (typeof ignored === 'undefined') {
				msg.reply('there are  no channels on the ignore list!');
				return;
			}

			if (msg.content === `${prefix}unignore all`) {
				winston.info(`CHANNEL UNIGNORE: All channels ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				guilds.remove(msg.guild.id, 'ignore');
				msg.reply('gotcha! I\'m baaack!  ＼(≧▽≦)／ (not going to ignore any channels anymore).');
				return;
			}

			if (!ignored.includes(msg.channel.id)) {
				msg.reply('this channel isn\'t on the ignore list!');
				return;
			}

			if (ignored.length === 1) {
				winston.info(`CHANNEL UNIGNORE: (${msg.channel.id}) ON GUILD ${msg.guild.name} (${msg.guild.id})`);
				guilds.remove(msg.guild.id, 'ignore');
				msg.reply('gotcha! I\'m baaack!  ＼(≧▽≦)／ (not going to ignore this channel anymore).');
				return;
			}

			const findIgnored = ignored.indexOf(msg.channel.id);

			if (findIgnored > -1) {
				ignored.splice(findIgnored, 1);
			}

			winston.info(`CHANNEL UNIGNORE: (${msg.channel.id}) ON GUILD ${msg.guild.name} (${msg.guild.id})`);
			guilds.set(msg.guild.id, 'ignore', ignored);
			msg.reply('I\'m baaack!  ＼(≧▽≦)／ (not going to ignore this channel anymore).');
		}
	});

client.login(config.token);

process.on('unhandledRejection', err => {
	winston.error(`Uncaught Promise Error:\n${err.stack}`);
});
