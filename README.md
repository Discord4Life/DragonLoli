# 2DFam Radio Bot (Fork from listen.moe)

## Command list

This list assumes a prefix of `toodee!`.

- `toodee!join`
  Type this while in a voice channel to have the bot join that channel and start playing there. Limited to users with the "manage server" permission.

- `toodee!leave`
  Makes the bot leave the voice channel it's currently in.

- `toodee!help`
  Shows a real basic usage help which is the same one that appears the first time the bot joins a guild.

- `toodee!ignore`
  Ignores commands in the current channel. Admin commands are exempt from the ignore.

- `toodee!unignore`
  Unignores commands in the current channel.
  
- `toodee!ignore all`
  Ignores commands in all channels on the guild.
  
- `toodee!unignore all`
  Unignores all channels on the guild.

- `toodee!prefix <new prefix>`
  Changes the bot's prefix for this server. Prefixes cannot contain whitespace, letters, or numbers - anything else is fair game. It's recommended that you stick with the default prefix of `~~`, but this command is provided in case you find conflicts with other bots.

## Run it yourself

NodeJS version 7+ is required. 

- Clone the repo.
- Create a Discord OAuth application and bot account.
- Rename/duplicate `config-sample.json` to `config.json` and fill out the relevant information.
- Install dependencies from npm.
- Install ffmpeg - if on Windows, make sure to add it to your PATH.
- Run the bot with `node --harmony 2dfam-radio.js` or if you use pm2 `pm2 start 2dfam-radio.js --node-args="--harmony"`
