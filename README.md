# Security-Server v1.1.0
Defensive Discord moderation bot for authorized servers. JavaScript handles Discord events; Python produces local incident reports.

## Protections
- Sliding-window message floods, normalized repeated messages including interleaved repeats, mention floods, optional Discord invite blocking and exact/subdomain matching for administrator-defined blocked hosts.
- Checks edited cached messages for links and mentions, without counting edits as new messages.
- Join surges and accounts younger than 24 hours trigger advisory alerts only; no automatic bans, kicks or lockdowns.
- Observe-only default. Optional enforcement deletes flagged messages and may briefly time out flood offenders. Owner/moderator/configured role exemptions, Discord hierarchy checks, bounded tracking, action budgets.
- Private moderator alerts and commands, rotating JSONL audit logs without message content or member IDs, counters for dropped logs and suppressed alerts. No external link requests.
- /security-status, /security-report, /security-check (Manage Server permission required).

## Setup
1. Install Node.js 22.12+ and Python 3.10+.
2. Run npm install --ignore-scripts in this directory. Review and retain the generated package-lock.json for reproducible installs.
3. Copy .env.example to .env, fill DISCORD_TOKEN, GUILD_ID and LOG_CHANNEL_ID. On Windows set PYTHON_BIN=python if necessary. Never commit .env or tokens.
4. At https://discord.com/developers/applications create your bot, enable Server Members and Message Content privileged intents (subject to Discord approval), install with bot and applications.commands scopes in a separate test guild.
5. Give View Channel, Send Messages and Embed Links for a dedicated moderator text channel, disable View Channel for @everyone and review other role overrides. Give Manage Messages and Moderate Members for optional enforcement. Ensure bot role is above moderated roles. Do not grant Administrator.
6. Run npm start or run.bat on Windows. Test in MODE=observe, tune policy, then optionally enable MODE=enforce and restart. BLOCK_INVITES defaults to false; BLOCKED_HOSTS is a comma-separated list of bare hostnames.

## Tests
npm run check, npm test, python -m unittest discover -s python.
The v1.0 ZIP is preserved as an archive; use the root source for v1.1. Do not commit .env, data, node_modules or Python cache.

## Limits
Single guild/process. Heuristic detection, not malware scanning, account takeover detection or a firewall. No bot/webhook scanning or uncached edit checks. Link matching is not exhaustive. Raid indicators do not prevent joins. Observe mode does not delete or timeout. Rate limits and bounded memory can suppress actions and alerts. Reports summarize sampled logged incidents, not every message, with two approximately 5 MiB files. Use native Discord AutoMod, verification levels, MFA and proper permissions. Protect the data directory. Test every release in a separate guild before production.
