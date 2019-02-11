var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var medication= new Schema({

	medicineName:String,
	medicineRate:Number,
	medicineVolume:Number,
	source:String,
	stationName: String,
	admin:String,
	_station:{type: Schema.ObjectId, ref: 'Station'},
	_task:{ type: Schema.ObjectId, ref: 'Task'},
	_bed:{ type: Schema.ObjectId, ref: 'Bed'},
	_patient:{ type: Schema.ObjectId, ref: 'Patient'},
	_infusionhistory:{ type: Schema.ObjectId, ref: 'Infusionhistory'},
});



module.exports = mongoose.model('Medication',medication);