var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var Dripo = new Schema({
	dripoId:{
		type:String, 
		required:true
	},
	altName:{
		type:String, 
		required:true
	},
	admin:{
		type:String,
		required:true
	},
	stationName:{
		type:String,
		required:true
	},
	_admin:{ 
		type: Schema.ObjectId, 
		ref: 'User' 
	},
	_station:{ 
		type: Schema.ObjectId, 
		ref: 'Station'
	},
	//for monitoring
	status:{
		type:String
	},
	monitor:{
		type:Boolean,
		default:false
	},
	time:Number,
	timeIn12:String,
	lastMessageMin:Number,
	rate:Number,
	bedName:String,
	topic:String,
	deviceCharge:Number,
	totalVolume:Number,
	timeRemaining:Number,
	percentage:Number,
	infusionStatus:String,
	infusedVolume:{type:Number,default:0},
	source:String,
});

module.exports = mongoose.model('Dripo', Dripo);