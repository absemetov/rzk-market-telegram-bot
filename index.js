const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Telegraf = require("telegraf");
const axios = require("axios");
const cc = require("currency-codes");

admin.initializeApp();

const bot = new Telegraf(functions.config().bot.token);

bot.start((ctx) => {
  return ctx.reply("Welcome to RZK Market Ukraine!");
});

//MonoBankApi
async function getMonoCurrency(currencyNumber) {
  try {
    const allCurrencyMonobank = await axios.get("https://api.monobank.ua/bank/currency");

    return allCurrencyMonobank.data.find((data) => {
      return data.currencyCodeA === currencyNumber;
    });

  } catch (error) {
    return false;
  }
}

//listen all text messages
bot.on("text", async (ctx) => {
  
  //Convers currency name to code
  const currency = cc.code(ctx.message.text);
  
  let currencyRate = {
    rateBuy: 0,
    rateSell: 0
  };

  //Check for existing currency
  if (!currency) {
    return ctx.reply("Currency didnt found");
  }
  
  //Get currency from Firebase
  const currencyFirebase = await admin.firestore().doc('currency/' + currency.code).get();
  
  //Update data
  if (currencyFirebase.exists) {
    //update rate, check timestamp
    currencyRate = currencyFirebase.data();

    let timeDiff = Math.floor(Date.now() / 1000) - currencyRate.date;
    
    if (timeDiff > 60) {
      let currencyMono = await getMonoCurrency(Number(currency.number));
    
      if (currencyMono) {
        currencyMono.date = Math.floor(Date.now() / 1000);
        await admin.firestore().doc('currency/' + currency.code).update(currencyMono); 
        currencyRate = currencyMono;
      }
    }

  } else {

    //return ctx.reply("No such document!");
    //add New currency
    let currencyMono = await getMonoCurrency(currency);
    
    if (currencyMono) {
      currencyMono.date = Math.floor(Date.now() / 1000);
      await admin.firestore().doc('currency/' + currency.code).set(currencyMono);
      currencyRate = currencyMono; 
    }

  }

  return ctx.replyWithMarkdown(`
  CURRENCY: *${currency.code}*
RATE BUY: *${currencyRate.rateBuy.toFixed(2)}*
RATE SELL: *${currencyRate.rateSell.toFixed(2)}*
  `); 

});

//bot.launch();

exports.bot = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  });

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//exports.helloWorld = functions.https.onRequest((request, response) => {
//  functions.logger.info("Hello logs!", {structuredData: true});
//  response.send("Hello from Firebase!");
//});
