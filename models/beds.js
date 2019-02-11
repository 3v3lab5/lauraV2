var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var Bed = new Schema({
	bedName:{
		type:String,
		required:true,
	},
	admin: {
		type:String,
		required:true,
	},
	stationName: {
		type:String,
		required:true,
	},
	status:{
		type:String,
		required:true,
	},
	_patient:{ type: Schema.ObjectId, ref: 'Patient' },
	_admin:{ type: Schema.ObjectId, ref: 'User' },
	_station:{ type: Schema.ObjectId, ref: 'Station'},

});

module.exports = mongoose.model('Bed', Bed);