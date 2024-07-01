require("dotenv").config();
const express = require("express");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

const gameName = "zuratap";
const webURL = "https://hackrunv3.s3.ap-south-1.amazonaws.com/index.html";

const server = express();
server.use(express.json()); // Add this line to parse JSON bodies

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  webHook: true
});

const domain = 'https://tg-9irl2qejb-surajbnps-projects.vercel.app/'; // Replace with your Vercel app URL
bot.setWebHook(`${domain}/bot${process.env.TELEGRAM_BOT_TOKEN}`);

const port = process.env.PORT || 5000;

const SCORE_TOKEN = 999999999;

const queries = {};

function addAllNumbers(number) {
  const strNumber = number.toString();
  if (strNumber.length === 1) return number;

  const numbers = strNumber.split("");
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += parseInt(numbers[i], 10);
  }
  return addAllNumbers(sum);
}

bot.onText(/\/help/, (msg) =>
  bot.sendMessage(
    msg.from.id,
    "This bot implements a simple game. Say /game if you want to play."
  )
);
bot.onText(/\/start|\/game/, (msg) => bot.sendGame(msg.from.id, gameName));
bot.on("callback_query", function (query) {
  if (query.game_short_name !== gameName) {
    bot.answerCallbackQuery(
      query.id,
      "Sorry, '" + query.game_short_name + "' is not available."
    );
  } else {
    queries[query.id] = query;
    const gameurl = `${webURL}?id=${query.id}`;
    bot.answerCallbackQuery(query.id, { url: gameurl });
  }
});
bot.on("inline_query", function (iq) {
  bot.answerInlineQuery(iq.id, [
    { type: "game", id: "0", game_short_name: gameName },
  ]);
});

server.use(express.static(path.join(__dirname, "public")));

server.get("/highscore/:score", function (req, res, next) {
  if (!Object.hasOwnProperty.call(queries, req.query.id)) return next();

  const token = SCORE_TOKEN[addAllNumbers(BigInt(req.query.id)) - 1];

  let query = queries[req.query.id];

  let options;
  if (query.message) {
    options = {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
    };
  } else {
    options = {
      inline_message_id: query.inline_message_id,
    };
  }

  const obfuscatedScore = BigInt(req.params.score);
  const realScore = Math.round(Number(obfuscatedScore / token));

  if (BigInt(realScore) * token == obfuscatedScore) {
    bot
      .setGameScore(query.from.id, realScore, options)
      .then((b) => {
        return res.status(200).send("Score added successfully");
      })
      .catch((err) => {
        if (
          err.response.body.description ===
          "Bad Request: BOT_SCORE_NOT_MODIFIED"
        ) {
          return res
            .status(204)
            .send("New score is inferior to user's previous one");
        } else {
          return res.status(500);
        }
      });
    return;
  } else {
    return res.status(400).send("Are you cheating?");
  }
});

server.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
