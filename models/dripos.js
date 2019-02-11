var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var Dripo = new Schema({
	dripoId:{
		type:String, 
		unique:true,
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
	status:{
		type:String
	}
});

module.exports = mongoose.model('Dripo', Dripo);