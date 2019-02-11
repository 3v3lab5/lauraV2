var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var Ivset = new Schema({
	ivsetModel:{
		type:String,
		required:true
	},
	ivsetDpf:{
		type:Number,
		required:true
	},
	admin: {
		type:String,
		required:true
	},
	_admin:{ type: Schema.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Ivset', Ivset);