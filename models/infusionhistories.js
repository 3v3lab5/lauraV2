var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var infusionhistory= new Schema({
_station:{ type: Schema.ObjectId, ref: 'Station'},
date:String,
bedName:String,
averageRate:{type:Number,default:0},
infusionDate: Date,
startingTime:String,
infusedVolume:Number,
totalVolume:Number,
endingTime:String,
dripoId:String,
message:[{status:String,time:String}],
infusionLogs:[{status:String,rate:Number,infusedVolume:Number,time:String,count:Number}],
batteryLogs:[{charge:Number,time:String,count:Number}],
error:[{status:String,time:String}],
lastError:{status:String,time:String},
});



module.exports = mongoose.model('Infusionhistory',infusionhistory);
