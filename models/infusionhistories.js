var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var infusionhistory= new Schema({
_station:{ type: Schema.ObjectId, ref: 'Station'},
date:String,
bedName:String,
infusionDate: Date,
startingTime:String,
infusedVolume:Number,
totalVolume:Number,
endingTime:String,
dripoId:String,
message:[{status:String,time:String}],
error:[{status:String,time:String}],
lastError:{status:String,time:String},
});



module.exports = mongoose.model('Infusionhistory',infusionhistory);
