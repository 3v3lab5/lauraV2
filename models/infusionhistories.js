var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var infusionhistory= new Schema({
_task:{ type: Schema.ObjectId, ref: 'Task'},
date:String,
infusionDate: Date,
startingTime:String,
infusedVolume:String,
endingTime:String,
dripoId:String,
message:[{status:String,time:String}],
error:[{status:String,time:String}],
lastError:{status:String,time:String},
});



module.exports = mongoose.model('Infusionhistory',infusionhistory);
