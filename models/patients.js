var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var Patient = new Schema({
	patientName:{
        type:String,
        required:true
    },
    patientAge:{
        type:Number,
        default:null
    },
    patientWeight:{
        type:Number,
        default:null
    },
    patientStatus:{
        type:String,
        defualt:"active"
    },
    patientGender:{
        type:String,
    },
    admin:{
        type:String,
    },
    admittedOn:Date,
    dischargedOn:Date,
    doctor:{ 
        type: String, 
        defualt:null
    },
    bedName:String,
    _bed:{ type: Schema.ObjectId, ref: 'Bed'},
    _station:{ type: Schema.ObjectId, ref: 'Station'},
    _medication:[{ type: Schema.ObjectId, ref: 'Medication'}],
});


module.exports = mongoose.model('Patient', Patient);