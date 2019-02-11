var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var task= new Schema({
time:Number,
timeIn12:String,
type:String,
status:String,
priority:Number,
createdAt:Date,
lastRunAt:Date,
nextRunAt:Date,
rate:Number,
topic:String,
deviceCharge:Number,
infusionStatus:String,
infusedVolume:{type:Number,default:0},
source:String,
timeRemaining:Number,
totalVolume:Number,
percentage:Number,
_station:{ type: Schema.ObjectId, ref: 'Station'},
_bed:{ type: Schema.ObjectId, ref: 'Bed'},
_patient:{ type: Schema.ObjectId, ref: 'Patient'},
_medication:{ type: Schema.ObjectId, ref: 'Medication'},
});

module.exports = mongoose.model('Task',task);

