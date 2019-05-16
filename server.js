/*
___      ___    __    __   ______    ____
| |	    / _  \  | |   } ) (      )  / __ \
| |    / /  \ \ | |   } | | ()  /  / /  \ |
| |___||___  | || |___} | |  |\  \ | |__| |
|_____|||   |__||______.) |__  \__\[__  [__]
 Version: 1.0.0 (dev)
  Author: rahulaunni@evelabs.co
  company: evelabs.co
 Website: http://evelabs.co

 */

const express = require('express');
var app = require('express')();
var server = require('http').Server(app);
const routes = require('./routes/api');
var morgan = require('morgan');
var bodyParser = require('body-parser');
const mongoose = require('mongoose');
// Use bluebird
mongoose.Promise = require('bluebird');
const cors = require('cors');
var jwt = require('jsonwebtoken');
var secret = 'lauraiswolverinesdaughter';
//var io = require('./lib/sockets').listen(server);
var io = require('./lib/socketsV2').listen(server);
require('dotenv').config()
var mlabUrl = process.env.MONGOLAB_URI;


//for logging requests
app.use(morgan('dev'));

app.use(cors());
//for parsing json body
app.use(bodyParser.json({extended : true}));
app.use(bodyParser.urlencoded({extended:true}));

//use routes/api file
app.use('/api',routes);


//error handling middleware
app.use(function (err,req,res,next) {
	if (err.name === 'MongoError' && err.code === 11000) {
		res.status(422).json({success:false,message:"already exist"});
	 } else {
	 	res.status(503).json({success:false,error:err.message});
	 }
})


//mongodb configuration
mongoose.Promise = global.Promise;
mongoose.connect(mlabUrl, { useNewUrlParser: true },function (err) {
// mongoose.connect('mongodb://localhost/dblaura',{ useNewUrlParser: true }, function(err) {
	if(err){
		console.log("Mongodb connection failed");
	}
	else{
		console.log("Mongodb connection success");
	}

});

//function to restrict routes based on user roles
function requireRole (role) {
    return function (req, res, next) {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send(403);
        }
    }
}

//listen to request
server.listen(process.env.PORT || 4000, function(){
    console.log("Server started listening in 4000");
});

module.exports = server;
