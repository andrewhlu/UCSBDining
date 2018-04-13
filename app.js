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
	session.replaceDialog('Startup');
})
.set('storage', tableStorage);

bot.dialog('Startup', [
	function (session) {
		var ans = session.message.text;
		var msg = "You entered: " + ans;
		console.log(msg);
		
		//User Info
		if(session.message && session.message.entities){
			var userInfo = session.message.entities.find((e) => {
				return e.type === 'UserInfo';
			});
	
			if (userInfo) {
				var name = userInfo.name.GivenName;
				//console.log(name);
			}
		}
		
		if(ans.search("finished") >= 0 || ans.search("finish") >= 0 || ans.search("done") >= 0) {
			//run finished script
		}
		else if(ans.search("eat") >= 0 || ans.search("good") >= 0 || ans.search("food") >= 0 || ans.search("hungry") >= 0) {
			var sayString = "Hello, " + name + "! Let's find you a good place to eat.";
			session.say(sayString, sayString);
			session.replaceDialog('FindDC');
		}
		else {
			var choices = [
	            {value: 'eat', action: {title: 'Eat!'}, synonyms: 'Recommend|Food|Hungry'},
	            {value: 'rate', action: {title: 'Rate!'}, synonyms: 'Done|Finish|Finished'}
	        ];
			
			var string1 = "Hello, " + name + "! What would you like to do?";
			var string2 = "Hello, " + name + "! What would you like to do? Would you like to eat or rate a meal?";
	        
	        builder.Prompts.choice(session, string1, choices, {
	            listStyle: builder.ListStyle.button,
	            speak: speak(session, string2) 
	        });
		}
	},
	function (session, results) {
		var ans = results.response.entity;
		var msg = "You entered: " + ans;
		console.log(msg);
		
		//add a FindDCFuture for future meals
		
		if(ans.search("finished") >= 0 || ans.search("finish") >= 0 || ans.search("done") >= 0) {
			//run finished script
		}
		else if(ans.search("eat") >= 0 || ans.search("good") >= 0 || ans.search("food") >= 0 || ans.search("hungry") >= 0) {
			session.say("Great! Let's find you a good place to eat.","Great! Let's find you a good place to eat.");
			session.replaceDialog('FindDC');
		}
		else {
			session.say("I'm sorry, I didn't understand. Let's try again.","I'm sorry, I didn't understand. Let's try again.");
			session.replaceDialog('Startup');
		}
	}
]);

bot.dialog('FindDC', [
	function (session) {
		session.say("Give me a moment to look at the menu.","Give me a moment to look at the menu.");
		
		var utcdate = new Date(); //Local time is UTC
		var utcMilli = utcdate.getTime();
		
		var date = new Date(utcMilli - 25200000); //Converts UTC time to PST
		console.log(date.toLocaleString());
		
		var year = date.getFullYear();
		var month = parseInt(date.getMonth()) + 1;
		var day = date.getDate();
		var weekday = date.getDay();
		var hour = date.getHours();
		
		var dateString = year + "-" + month + "-" + day;
		
		var dchours = [[2,2,2,2,2,2,2,2,2,2,2,2,2,2,4,4,4,4,4,4,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,3,3,3,3,3,4,4,4,4,4,5,5,5,5],[1,1,1,1,1,1,1,1,1,1,3,3,3,3,3,4,4,4,4,4,5,5,5,5],[1,1,1,1,1,1,1,1,1,1,3,3,3,3,3,4,4,4,4,4,5,5,5,5],[1,1,1,1,1,1,1,1,1,1,3,3,3,3,3,4,4,4,4,4,5,5,5,5],[1,1,1,1,1,1,1,1,1,1,3,3,3,3,3,4,4,4,4,4,0,0,0,0],[2,2,2,2,2,2,2,2,2,2,2,2,2,2,4,4,4,4,4,4,0,0,0,0]];
		//1 = breakfast
		//2 = brunch
		//3 = lunch
		//4 = dinner
		//5 = late night
		//0 = closed for day
		
		var mealname = [0,"Breakfast","Brunch","Lunch","Dinner","Late Night"];
		
		var requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=" + mealname[dchours[weekday][hour]];
		console.log(requestString);

		if(mealname[dchours[weekday][hour]] == 0) {
			session.say("Oh no. It looks like all the Dining Commons have closed for the remainder of the day. Sorry!");
		}
		else {
			request(requestString, function (error, response, body) {
				console.log('error:', error); // Print the error if one occurred
				console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
				//console.log('body:', body);

				//Extract menus from website
				const analyze = cheerio.load(body);
				var carrilloBody = analyze('#Carrillo-body .panel-body').html();
				var delaguerraBody = analyze('#DeLaGuerra-body .panel-body').html();
				var ortegaBody = analyze('#Ortega-body .panel-body').html();
				var portolaBody = analyze('#Portola-body .panel-body').html();

				//Remove dl, dt, dd tags, dt elements
				carrilloBody = carrilloBody.replace(/(>\s)/g, '');
				console.log(carrilloBody);


			});
		}



		

		
		
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



// Helper function to wrap SSML stored in the prompts file with <speak/> tag.
function speak(session, prompt) {
	var localized = session.gettext(prompt);
	return ssml.speak(localized);
}