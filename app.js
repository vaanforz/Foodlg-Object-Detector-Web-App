'use strict';

var request = require('request');
var yargs = require('yargs');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

const rp = require('request-promise');
const session = require('express-session');
const { ExpressOIDC } = require('@okta/oidc-middleware');
const fs = require('fs');
var model_options = {'null': 'null'};
fs.readFile('model_options.json', (err, data) => {
		    if (err) throw err;
		    model_options = JSON.parse(data);
});

var args = yargs
  .default('port', 8090)
  .default('model', 'http://localhost:5000')
  .argv;

app.use(bodyParser.json({
    type: function(req) {
        return req.get('content-type').indexOf('multipart/form-data') !== 0;
    },
}));
app.use(express.static('static'));
app.set('views', 'static/');

app.engine('.ejs', require('ejs').__express);
app.set('view engine', 'ejs');

// session support is required to use ExpressOIDC
app.use(session({
  secret: 'this should be secure',
  resave: true,
  saveUninitialized: false
}));

const oidc = new ExpressOIDC({
  issuer: 'https://dev-145826.okta.com/oauth2/default',
  client_id: '0oa21wafmPNbZLDpa4x6',
  client_secret: 'jJyWxsS8s8yXttXuU0MsPkxh13U8iJi_jreQmtR1',
  appBaseUrl: 'http://ec2-52-77-215-17.ap-southeast-1.compute.amazonaws.com:8090',
  redirect_uri: 'http://ec2-52-77-215-17.ap-southeast-1.compute.amazonaws.com:8090/authorization-code/callback',
  scope: 'openid profile'
});

// ExpressOIDC will attach handlers for the /login and /authorization-code/callback routes
app.use(oidc.router);

function getOktaApiParams(req, requestType) {
	const userID = req.userContext.userinfo.sub;
	const userURI = ('https://dev-145826.okta.com/api/v1/users/' + userID);
	const std_headers = {'Accept':'application/json',
	                    'Content-Type': 'application/json',
					    'Authorization': 'SSWS 000NZ7ilEQrvBP8xPtxSimrmp8aSumdAHnbAWZPi1l'
					   };
	var params = {
		    method: 'GET',
		    uri: userURI,
		    json: true,
		    headers: std_headers
	};
	if (requestType == 'GetCurrentUser'){

	} else if (requestType == 'GetCurrentUserGroups'){
		params.uri = (userURI + '/groups');
	}
	return params;
}

app.get('/', (req, res) => {
  	if (req.userContext) {
		async function oktaGetCurrentUser_response() {
		    const userInfo = await rp(getOktaApiParams(req,'GetCurrentUser'));
		    res.render("index.ejs", {userContext: req.userContext,
		    						 userInfo: userInfo,
		    						 modelOptions: Object.keys(model_options),
		    						});
		}
		oktaGetCurrentUser_response();
  	} else {
		    res.render("index.ejs", {userContext: null,
		    						 userInfo: null,
		    						 modelOptions: Object.keys(model_options),
		    						});
  	}
});

app.all('/model/predict', oidc.ensureAuthenticated(), function(req, res) {
	const userID = req.userContext.userinfo.sub;
	const userURI = ('https://dev-145826.okta.com/api/v1/users/' + userID);
	var model_endpoint = model_options[req.query.chosen_model]["endpoint"];

	return rp(getOktaApiParams(req,'GetCurrentUser')).then(body => {
		var quota = body.profile.quota;
		if(quota === undefined){
			quota = 100
		}
		const oktaUpdateCurrentUserQuota = {
		    method: 'POST',
		    uri: userURI,
		    json: true,
		    headers: {
		    	'Accept':'application/json',
		        'Content-Type': 'application/json',
		        'Authorization': 'SSWS 000NZ7ilEQrvBP8xPtxSimrmp8aSumdAHnbAWZPi1l'
		    },
		    body: {
		    "profile": {
		    	"quota": (quota-1),
		    }
		  }
		};
		return rp(oktaUpdateCurrentUserQuota);
	 }).then(body => {
	    req.pipe(request(model_endpoint + req.path))
		    .on('error', function(err) {
		      console.error(err);
		      res.status(500).send('Error connecting to the model microservice');
		    })
		    .pipe(res);
	 }).catch(err => {
	     res.status(400).send(err);
	 });
});

app.get('/admin', oidc.ensureAuthenticated(), function(req, res) {
	fs.readFile('model_options.json', (err, data) => {
		    if (err) throw err;
		    model_options = JSON.parse(data);
	});
	async function oktaGetCurrentUserGroups_response() {
		var groups = [];
	    const userGroupsInfo = await rp(getOktaApiParams(req,'GetCurrentUserGroups'));
	    for (var i = 0; i < userGroupsInfo.length; i++) {
	    	groups.push(userGroupsInfo[i].profile.name);
	    }
	    if(groups.includes('Admin')) {
		    res.render("admin.ejs", {userContext: req.userContext,
		    						 modelOptionsKeys: Object.keys(model_options),
		    						 modelOptions: model_options,
		    });
		} else {
			res.status(401).send('Error! Unauthorized.');
		}
	}
	oktaGetCurrentUserGroups_response();
});

app.post('/saveModelJSON', oidc.ensureAuthenticated(), function(req, res) {
	fs.writeFile('model_options.json', JSON.stringify(req.body), (err) => {  
    	if (err) throw err;
    });
    model_options = req.body;
    res.send('Success')
});

oidc.on('ready', () => {
  app.listen(args.port, () => console.log('Started!'));
});

oidc.on('error', err => {
  console.log('Unable to configure ExpressOIDC', err);
});

console.log('Web App Started on Port ' + args.port);
console.log('Using Model Endpoint: ' + args.model);
console.log('Press Ctrl-C to stop...');
