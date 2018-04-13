/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var request = require('request');
var fetch = require('node-fetch');
var ssml = require('./ssml');
var cheerio = require('cheerio');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user

var bot = new builder.UniversalBot(connector, function (session) {
    var ans = results.response.entity;
    var msg = "You entered: " + ans;
    console.log(msg);
    
    if(ans.search("finished") >= 0 || ans.search("finish") >= 0 || ans.search("done") >= 0) {
        //run finished script
    }
    
    
    //session.send(msg);
    
    
    
    session.replaceDialog('FindDC');
});
    
bot.dialog('FindDC', [
    function (session) {        
        //get initial text
        //see if they passed a meal period over (breakfast, lunch, dinner)
        //if not, then take the next meal
        
        session.say("Let me look at the menus.","Let me look at the menus.");
        
        requestMeal(3);
        
        
        // var body = fetch('https://appl.housing.ucsb.edu/menu/day/?dc=Carrillo&dc=DeLaGuerra&dc=Ortega&dc=Portola&m=Breakfast')
        //     .then(res => res.text())
        //     .then(body => cheerio.load(body));
                  
        //   .then(menu => ('#Carrillo-body dd').html())
        //   .then(console.log(menu));
        
        
        //const $ = cheerio.load(test)
        
        //scrap the website
        //extract the meal time
        //extract the menus
        //compare with your tallies
        //dc with most tallies gets chosen and returned
        
        
        
    },
    function (session, results) {
        var ans = results.response.entity;
        var msg = "You entered: " + ans;
        console.log(msg);
        //session.send(msg);
        
        session.say(msg, msg);
        
        // name = results.response;
        builder.Prompts.text(session, "We need a little more information about you to predict your favorite dog. Hang in there and tell me your current city");
    },
    function (session, results) {
        city = results.response;
        var msg = "Name: " + name + "<br/> City: " + city;
        console.log(msg);
        session.send(msg);
        
        session.send("Thanks. We're launching a webpage for you."); 
    }
]);

/** Helper function to wrap SSML stored in the prompts file with <speak/> tag. */
function speak(session, prompt) {
    var localized = session.gettext(prompt);
    return ssml.speak(localized);
}

//Request function
function requestMeal(meal) {
    var meals = ["Breakfast", "Brunch", "Lunch", "Dinner", "Late Night"];
    
    var date = new Date();
    console.log(date.toLocaleString());
    
    var month = parseInt(date.getMonth()) + 1;
    
    var dateString = date.getFullYear() + "-" + month + "-" + date.getDate();
    
    var requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=" + meals[meal];
    console.log(requestString);
    
    request(requestString, function (error, response, body) {
          console.log('error:', error); // Print the error if one occurred
          console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
          analyzeMeal(body);
        });
}

function analyzeMeal(body) {
    //console.log(body);
    
    const analyze = cheerio.load(body);
    var result1 = analyze('#Carrillo-body .panel-body').html();
    console.log(result1);
    // var result2 = analyze('#Ortega-body dl').html();
    // console.log(result2);
}