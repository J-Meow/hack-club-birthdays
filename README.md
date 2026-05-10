# Hack Club Birthdays

A pretty simple website that shows Hack Clubbers' birthdays to each other so they know when to celebrate!

Includes Hack Club Auth integration, the ability to set your own birthdate (month and day only, no year), and the ability to link your personal Slack channel!

## Setup

1. Create a Postgres database somewhere the server running the app will be able to access it.
2. Create a table in that database using the following query: `CREATE TABLE users (id text PRIMARY KEY, name text NOT NULL, pfp text NOT NULL, bday_month integer, bday_day integer, channel_name text, channel_id text)`
3. Create an HCA app with scopes `slack_id` and a redirect URI of `https://wherever.you.are.hosting.the.website/auth/callback`
4. Create a Slack app from the manifest `slack_manifest.json` and install it to the Hack Club workspace
5. Build the Dockerfile and run it with environment variables similar to `.env.example`, while exposing port 3000 to the internet using a method of your choice.
6. You're done!

