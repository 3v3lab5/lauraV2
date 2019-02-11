var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var Station = new Schema({
	stationName:{
		type:String,
		required:true,
	},
	admin: {
		type:String,
		required:true,
	},
	_admin:{ type: Schema.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Station', Station);