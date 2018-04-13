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

//Define global variables here
var requestBody = "blank";
var mealname = "blank";
var requestString = "blank";
var dcMenuArray = [];

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

		//add a FindDCFuture for future meals
		//add first time script

		var preferences = session.userData.userPreferences;
		console.log(preferences);

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
		//add first time script
		
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
		
		var mealname = [0,"Breakfast","Brunch","Lunch","Dinner","LateNight"];
		
		var requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=" + mealname[dchours[weekday][hour]];
		console.log(requestString);

		if(mealname[dchours[weekday][hour]] == 0) {
			session.say("Oh no. It looks like all the Dining Commons have closed for the remainder of the day. Sorry!","Oh no. It looks like all the Dining Commons have closed for the remainder of the day. Sorry!");
		}
		else {
			fetch(requestString)
		    .then(res => res.text())
		    .then(body => {
		    	requestBody = body;
		    });
			
			setTimeout(function(){ 
				//Extract menus from website
				const analyze = cheerio.load(requestBody);
				var carrilloBody = analyze('#Carrillo-body .panel-body').html();
				var delaguerraBody = analyze('#DeLaGuerra-body .panel-body').html();
				var ortegaBody = analyze('#Ortega-body .panel-body').html();
				var portolaBody = analyze('#Portola-body .panel-body').html();

				//Send menus to menuregex function
				var carrilloMenu = menuregex(carrilloBody);
				var delaguerraMenu = menuregex(delaguerraBody);
				var ortegaMenu = menuregex(ortegaBody);
				var portolaMenu = menuregex(portolaBody);

				//Get user preferences
				var preferences = session.userData.userPreferences;
				console.log(preferences);

				//Analyze menus with user preferences
				var carrilloResult = analyzeMenu(carrilloMenu, preferences);
				var delaguerraResult = analyzeMenu(delaguerraMenu, preferences);
				var ortegaResult = analyzeMenu(ortegaMenu, preferences);
				var portolaResult = analyzeMenu(portolaMenu, preferences);

				//Find DC with largest count
				var result = indexOfMax(carrilloResult[0],delaguerraResult[0],ortegaResult[0],portolaResult[0]);
				console.log(result);

				//Speak to user
				var dc = ["Carrillo", "DLG", "Ortega", "Portola"];
				console.log(dc[result]);

				var sayString = "I think you'll like " + dc[result] + "! They have " + carrilloResult[0] + " items that you like, including " + carrilloResult[1][0] + ", " + carrilloResult[1][1] + ", and " + carrilloResult[1][2] + ".";
				session.say(sayString, sayString);
			}, 5000);
			
			
		}
	}
]);

bot.dialog('RateMeal', [
	function (session) {
		var utcdate = new Date(); //Local time is UTC
		var utcMilli = utcdate.getTime();
		
		var date = new Date(utcMilli - 25200000); //Converts UTC time to PST
		console.log(date.toLocaleString());
		
		var weekday = date.getDay();

		if(weekday >= 1 && weekday <= 4) {
			//mon to thurs
			var choices = [
	            {value: 'breakfast', action: {title: 'Today\'s Breakfast'}, synonyms: 'morning'},
	            {value: 'lunch', action: {title: 'Today\'s Lunch'}, synonyms: 'afternoon'},
	            {value: 'dinner', action: {title: 'Today\'s Dinner'}, synonyms: 'supper|night'},
	            {value: 'latenight', action: {title: 'Today\'s Late Night'}, synonyms: 'midnight'},
	            {value: 'other', action: {title: 'Another Meal'}, synonyms: 'something else|another time|another meal'}
	        ];
			
			var string = "What meal would you like to rate?";
	        
	        builder.Prompts.choice(session, string, choices, {
	            listStyle: builder.ListStyle.button,
	            speak: speak(session, string) 
	        });
		}
		else if(weekday == 5) {
			//fri
			var choices = [
	            {value: 'breakfast', action: {title: 'Today\'s Breakfast'}, synonyms: 'morning'},
	            {value: 'lunch', action: {title: 'Today\'s Lunch'}, synonyms: 'afternoon'},
	            {value: 'dinner', action: {title: 'Today\'s Dinner'}, synonyms: 'supper|night'},
	            {value: 'other', action: {title: 'Another Meal'}, synonyms: 'something else|another time|another meal'}
	        ];
			
			var string = "What meal would you like to rate?";
	        
	        builder.Prompts.choice(session, string, choices, {
	            listStyle: builder.ListStyle.button,
	            speak: speak(session, string) 
	        });
		}
		else if(weekday == 0 || weekday == 6) {
			//weekend
			var choices = [
	            {value: 'brunch', action: {title: 'Today\'s Brunch'}, synonyms: 'morning|afternoon|breakfast|lunch'},
	            {value: 'dinner', action: {title: 'Today\'s Dinner'}, synonyms: 'supper|night'},
	            {value: 'other', action: {title: 'Another Meal'}, synonyms: 'something else|another time|another meal'}
	        ];
			
			var string = "What meal would you like to rate?";
	        
	        builder.Prompts.choice(session, string, choices, {
	            listStyle: builder.ListStyle.button,
	            speak: speak(session, string) 
	        });
		}
	},
	function (session, results) {
		var ans = results.response.entity;
		var msg = "You entered: " + ans;
		console.log(msg);

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


		if(weekday >= 1 && weekday <= 4) {
			if(ans.search("breakfast") >= 0 || ans.search("morning") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Breakfast";
				mealname = "Breakfast";
				session.replaceDialog('RateSelectedMeal');
			}
			else if(ans.search("lunch") >= 0 || ans.search("afternoon") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Lunch";
				mealname = "Lunch";
				session.replaceDialog('RateSelectedMeal');
			}
			else if(ans.search("dinner") >= 0 || ans.search("supper") >= 0 || ans.search("night") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Dinner";
				mealname = "Dinner";
				session.replaceDialog('RateSelectedMeal');
			}
			else if(ans.search("late night") >= 0 || ans.search("midnight") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=LateNight";
				mealname = "Late Night";
				session.replaceDialog('RateSelectedMeal');
			}
			else {
				session.say("Sorry, I don't understand. Let's try again.","Sorry, I don't understand. Let's try again.");
				session.replaceDialog('RateMeal');
			}
		}
		else if(weekday == 5) {
			if(ans.search("breakfast") >= 0 || ans.search("morning") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Breakfast";
				mealname = "Breakfast";
				session.replaceDialog('RateSelectedMeal');
			}
			else if(ans.search("lunch") >= 0 || ans.search("afternoon") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Lunch";
				mealname = "Lunch";
				session.replaceDialog('RateSelectedMeal');
			}
			else if(ans.search("dinner") >= 0 || ans.search("supper") >= 0 || ans.search("night") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Dinner";
				mealname = "Dinner";
				session.replaceDialog('RateSelectedMeal');
			}
			else {
				session.say("Sorry, I don't understand. Let's try again.","Sorry, I don't understand. Let's try again.");
				session.replaceDialog('RateMeal');
			}
		}
		else if(weekday == 0 || weekday == 6) {
			if(ans.search("brunch") >= 0 || ans.search("morning") >= 0|| ans.search("afternoon") >= 0|| ans.search("breakfast") >= 0|| ans.search("lunch") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Brunch";
				mealname = "Brunch";
				session.replaceDialog('RateSelectedMeal');
			}
			else if(ans.search("dinner") >= 0 || ans.search("supper") >= 0 || ans.search("night") >= 0) {
				requestString = "https://appl.housing.ucsb.edu/menu/day/?d=" + dateString + "&m=Dinner";
				mealname = "Dinner";
				session.replaceDialog('RateSelectedMeal');
			}
			else {
				session.say("Sorry, I don't understand. Let's try again.","Sorry, I don't understand. Let's try again.");
				session.replaceDialog('RateMeal');
			}
		}
	}
]);

bot.dialog('RateSelectedMeal', [
	function (session) {
		var choices = [
            {value: 'Carrillo', action: {title: 'Carrillo'}, synonyms: 'first'},
            {value: 'DeLaGuerra', action: {title: 'De La Guerra (DLG)'}, synonyms: 'de la guerra|DLG|second'},
            {value: 'Ortega', action: {title: 'Ortega'}, synonyms: 'third'},
            {value: 'Portola', action: {title: 'Portola'}, synonyms: 'fourth|last'}
        ];
		
		var string = "Great! Where did you eat?";
        
        builder.Prompts.choice(session, string, choices, {
            listStyle: builder.ListStyle.button,
            speak: speak(session, string) 
        });
	},
	function (session, results) {
		var ans = results.response.entity;
		var msg = "You entered: " + ans;
		console.log(msg);

		session.say("Great! Let's pull up the menu.","Great! Let's pull up the menu.");

		console.log(requestString);

		fetch(requestString)
	    .then(res => res.text())
	    .then(body => {
	    	requestBody = body;
	    });
		
		setTimeout(function(){
			//Extract menus from website
			const analyze = cheerio.load(requestBody);
	
			if(ans.search("Carrillo") >= 0) {
				var menuBody = analyze('#Carrillo-body .panel-body').html();
			}
			else if(ans.search("DeLaGuerra") >= 0 || ans.search("De La Guerra") >= 0 || ans.search("DLG") >= 0) {
				var menuBody = analyze('#DeLaGuerra-body .panel-body').html();
			}
			else if(ans.search("Ortega") >= 0) {
				var menuBody = analyze('#Ortega-body .panel-body').html();
			}
			else if(ans.search("Portola") >= 0) {
				var menuBody = analyze('#Portola-body .panel-body').html();
			}
	
			//Send menu to menuregex function
			var dcMenu = menuregex(menuBody);
	
			//Convert menu string to array
			dcMenuArray = dcMenu.split("\n");
			console.log(dcMenuArray);
	
			//Move to selectFavorites dialog
			session.replaceDialog('selectFavorites');
		}, 3000);
	}
]);

bot.dialog('selectFavorites', [
	function (session) {
		console.log(dcMenuArray);

		var choices = [];

		for(var i = 0; i < dcMenuArray.length; i++) {
			if(dcMenuArray[i] != undefined) {
				var addChoice = {
					value: i,
					action: {
						title: dcMenuArray[i]
					}
				};

				choices.push(addChoice);
			}
		}
		
		var string = "Tap on an item to add it to your favorites.";
        
        builder.Prompts.choice(session, string, choices, {
            listStyle: builder.ListStyle.button,
            speak: speak(session, string) 
        });
	},
	function(session, results) {
		var ans = results.response.entity;
		var msg = "You entered: " + ans;
		console.log(msg);

		//Get user preferences
		var preferences = session.userData.userPreferences;

		preferences.push(dcMenuArray[i]);
		session.userData.userPreferences = preferences;

		delete dcMenuArray[i];

		session.say("Great! Any others?","Great! Any others?");
		session.replaceDialog('selectFavorites');
	}

]);

// Helper function to wrap SSML stored in the prompts file with <speak/> tag.
function speak(session, prompt) {
	var localized = session.gettext(prompt);
	return ssml.speak(localized);
}

function menuregex(menu) {
	//Remove white space after newline
	menu = menu.replace(/(\n)(\s)+/g, '');
	
	//Remove all dl and /dl tags
	menu = menu.replace(/(<dl>)/g, '');
	menu = menu.replace(/(<\/dl>)/g, '');

	//Change &amp; to &, &apos; to '
	menu = menu.replace(/(&amp;)/g, '&');
	menu = menu.replace(/(&apos;)/g, '\'');

	//Remove all dt and content inside
	menu = menu.replace(/(<dt>)([\w\s\(\)\/\&\'])+(<\/dt>)/g, '');

	//Remove all dd tags
	menu = menu.replace(/(<dd>)/g, '');

	//Replace all /dd tags with a newline
	menu = menu.replace(/(<\/dd>)/g, '\n');

	return menu;
}

function analyzeMenu(menu, preferences) {
	var goodfoodcount = 0;
	var goodfood = [];

	for(i = preferences.length; i > 0; i--) {
		if(menu.search(preferences[i]) > 0) {
			goodfoodcount = goodfoodcount + 1;
			goodfood.unshift(preferences[i]);
		}
	}

	console.log("User likes " + goodfoodcount + " items.");
	console.log(goodfood);

	return [goodfoodcount, goodfood];
}

function indexOfMax(arr) {
    if (arr.length === 0) {
        return -1;
    }

    var max = arr[0];
    var maxIndex = 0;

    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }

    return maxIndex;
}