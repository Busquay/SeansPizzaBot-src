/*-----------------------------------------------------------------------------
A simple pizza ordering bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");

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

// Toppings are declared for demo purposes.
var toppings = {
    "Cheese" : { 
        name: "Cheese",
        title: "Freshly shredded mozzarella cheese",
        imageUrl: "http://www.dokani.com.bd/wp-content/uploads/2015/06/MOZZARELLA_CHEESE_FOR_PIZZA.jpg"
    },
    "Pepperoni" : { 
        name: "Pepperoni",
        title: "Freshly sliced spicy pepperoni",
        imageUrl: "https://www.eddiesmarket.net/wp-content/uploads/2017/08/pepperoni-slices.jpg"
    },
    "Sausage" : { 
        name: "Sausage",
        title: "Delicious italian sausage",
        imageUrl: "https://www.hormelfoodservice.com/wp-content/uploads/2015/12/Masterpieces-featured-product.jpg"
    },
    "Ham" : { 
        name: "Ham",
        title: "Sweet sliced ham",
        imageUrl: "http://images.wisegeek.com/canadian-bacon.jpg"
    },
    "Mushrooms" : { 
        name: "Mushrooms",
        title: "Freshly sliced garden mushrooms",
        imageUrl: "http://goldcirclemushrooms.com/wp-content/uploads/2017/06/shutterstock_73632907.jpg"
    },
    "Green Peppers" : { 
        name: "Green Peppers",
        title: "Freshly sliced green pepper rings",
        imageUrl: "https://www.kumandgo.com/content/uploads/kg-ingredients-greenpeppers.png"
    },
    "Pineapple" : { 
        name: "Pineapple",
        title: "Freshly cut pineapple chunks",
        imageUrl: "https://sc02.alicdn.com/kf/HTB17ry0KFXXXXbLXXXXq6xXFXXXr/IQF-frozen-pineapple-tidbits-1-12-cut.jpg"
    },
    "Done" : { 
        name: "Done",
        title: "",
        imageUrl: ""
    }
};

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', tableStorage);

bot.dialog('/', [
    function (session) {
        builder.Prompts.confirm(session, "Hello, welcome to Speedway Pizza!  I am your pizza bot.\r\nWould you like to order a pizza?");
    },
    function (session, results) {
        if (results.response) {
            session.conversationData.currentPizza = 0;
            builder.Prompts.text(session, "Excellent! What is your name?");
        }
        else {
            session.send("Ok then, contact me if you change your mind and would like a pizza.");
            session.endDialog();
        }
    },
    function (session, results) {
        session.userData.name = results.response;
        session.beginDialog("orderPizza");
    },
    function (session) {
        var orderSummary = "OK, here is a summary of your order:";
        for (var p = 0; p < session.conversationData.pizzas.length; p++){
            orderSummary += getPizzaDesc(session.conversationData.pizzas[p]);
        }
        orderSummary += "\n\nYour pizza will be ready in 15-20 minutes.";
        session.send(orderSummary);
        session.endConversation("Thanks for choosing Speedway Pizza!");
    }
]);
bot.dialog("orderPizza", [
    function (session, results) {
        builder.Prompts.choice(session, "Hi " + session.userData.name + "! What size pizza would you like to order?",
         ["Small", "Medium", "Large"], { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        if (!session.conversationData.pizzas) {
            session.conversationData.pizzas = new Array();
        }
        session.conversationData.pizzas.push({
            size: results.response.entity,
            toppings: []
        });
        session.send("Ok, " + session.conversationData.pizzas[session.conversationData.currentPizza].size + " it is.");
        session.beginDialog("addToppings");
    },
    function (session, results) {
        var pizzaDesc = getPizzaDesc(session.conversationData.pizzas[session.conversationData.currentPizza]);
        session.send(pizzaDesc);
        session.conversationData.currentPizza = session.conversationData.currentPizza + 1;
        builder.Prompts.confirm(session, "Would you like to order another pizza?");
    },
    function (session, results) {
        if (results.response) {
            session.replaceDialog("orderPizza");
        }
        else {
            session.endDialog();
        }
    }
]);
bot.dialog("addToppings", [
    function(session, args) {
        if (args && args.reprompt){ 
        }
        else {
            session.conversationData.toppings = new Array();
            session.conversationData.pizzas[session.conversationData.currentPizza]
                .toppings.push(toppings["Done"]);
        }
        builder.Prompts.choice(session, "Select your pizza topping:", toppings, { listStyle: builder.ListStyle.button });
    },
    function(session, results) {
        if (results.response.entity.match(/^Done$/i)){
            session.endDialog();
        }
        else {
            var addTopping = true;
            for(var i = 0; i < session.conversationData.pizzas[session.conversationData.currentPizza].toppings.length; i ++) {
                if (session.conversationData.pizzas[session.conversationData.currentPizza].toppings[i].name == results.response.entity) {
                    var msg = session.conversationData.pizzas[session.conversationData.currentPizza].toppings[i].name + " was already selected";
                    session.send(msg);
                    addTopping = false;
                }
            }
            if (addTopping){
                var topping = toppings[results.response.entity];
                var card = new builder.ThumbnailCard(session)
                    .title(topping.title)
                    .images([builder.CardImage.create(session, topping.imageUrl)]);
                var msg = new builder.Message(session).addAttachment(card);
                session.send(msg);
                session.conversationData.pizzas[session.conversationData.currentPizza].toppings.push(topping);
            }
            session.replaceDialog("addToppings", { reprompt: true });
        }
    }
]);

function getPizzaDesc(currentPizza) {
    var pizzaDesc = "\n\n1 " + currentPizza.size + " pizza, with ";
    for (var i = 1; i < currentPizza.toppings.length; i++) {
        pizzaDesc += currentPizza.toppings[i].name;
        if (i < currentPizza.toppings.length - 1) {
            pizzaDesc += ", ";
        }
    }
    return pizzaDesc;
};

