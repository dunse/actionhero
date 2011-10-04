////////////////////////////////////////////////////////////////////////////
// DAVE API Framweork in node.js
// Evan Tahler @ Fall 2011

////////////////////////////////////////////////////////////////////////////
// Force NPM to be update... you probably don't want this in production
// exec = require('child_process').exec
// exec("npm update");

////////////////////////////////////////////////////////////////////////////
// Init

var api = api = api || {}; // the api namespace.  Everything uses this.

api.sys = require("sys"),
api.http = require("http"),
api.url = require("url"),
api.path = require("path"),
api.fs = require("fs");

api.expressServer = require('express')
api.app = api.expressServer.createServer();
api.app.use(api.expressServer.cookieParser());
api.configData = JSON.parse(api.fs.readFileSync('config.json','utf8')); 

api.utils = require("./utils.js").utils;
api.log = require("./logger.js").log;
api.tasks = require("./tasks.js").tasks;
for(var task in api.tasks){if (task != "Task"){api.log("task loaded: "+task)}}
api.build_response = require("./response.js").build_response; 

// ensure the logging directory exists
try { api.fs.mkdirSync(api.configData.logFolder, "777") } catch(e) {}; 
api.app.listen(api.configData.serverPort);

////////////////////////////////////////////////////////////////////////////
// DB setup

////////////////////////////////////////////////////////////////////////////
// postVariable config and load
api.postVariables = api.configData.postVariables || [];

////////////////////////////////////////////////////////////////////////////
// populate actions & Tasks
api.actions = {};
api.actionsArray = [];
api.fs.readdirSync("./actions").forEach( function(file) {
	var actionName = file.split(".")[0];
	api.actions[actionName] = require("./actions/" + file)[actionName];
	api.actionsArray.push(actionName);
	api.log("action loaded: " + actionName);
});

////////////////////////////////////////////////////////////////////////////
// Periodic Tasks (fixed timer events)
if (api.configData.cronProcess)
{
	api.processCron = require("./cron.js").processCron;
	api.cronTimer = setTimeout(api.processCron, api.configData.cronTimeInterval, api);
	api.log("periodic (internal cron) interval set to process evey " + api.configData.cronTimeInterval + "ms");
}

api.log("*** Server Started @ " + api.utils.sqlDateTime() + " @ port " + api.configData.serverPort + " ***");

////////////////////////////////////////////////////////////////////////////
// Request Processing
api.app.get('/', function(req, res, next){
	api.timer = {};
	api.timer.startTime = new Date().getTime();
	api.response = {}; // the data returned from the API
	api.error = false; 	// errors and requst state
	
	//params & cookies
	api.params = {};
	api.postVariables.forEach(function(postVar){
		api.params[postVar] = req.param(postVar);
		if (api.params[postVar] === undefined){ api.params[postVar] = req.cookies[postVar]; }
	});
	
	if(api.configData.logRequests){api.log("request from " + req.connection.remoteAddress + " | params: " + JSON.stringify(api.params));}
		
	// process
	api.action = undefined;
	if(api.params["action"] == undefined)
	{
		api.error = "You must provide an action. Use action=describeActions to see a list."
	}
	else
	{
		if(api.actions[api.params["action"]] != undefined)
		{
			api.action = api.params["action"];
			api.actions[api.action](api);
		}
		else
		{
			api.error = "That is not a known action. Use action=describeActions to see a list."
		}
	}
	
	// response
	var response = api.build_response(res);
  	res.send(response);
	if(api.configData.logRequests){api.log("request from " + req.connection.remoteAddress + " | response: " + JSON.stringify(response));}
});