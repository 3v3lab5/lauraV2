var socketio = require('socket.io');
var mqtt = require('mqtt')
var ObjectId = require('mongodb').ObjectID;
var cron = require('node-cron');
const fs = require('fs');


var Station = require('../models/stations');
var Bed = require('../models/beds');
var Ivset = require('../models/ivsets');
var Dripo = require('../models/dripos');
var Patient = require('../models/patients');
var Medication = require('../models/medications');
var Task = require('../models/tasks');
var Infusionhistory = require('../models/infusionhistories');

const mongoose = require('mongoose');
// Use bluebird
mongoose.Promise = require('bluebird');

module.exports.listen = function(server){
    io = socketio.listen(server)
    //MQTT Configuration
   var client = mqtt.connect('mqtt://localhost:1883',{clientId:"LauraClient"});
    // var client = mqtt.connect('mqtts://192.168.50.62:8883',{clientId:"LauraClient",rejectUnauthorized: false,
    // port:8883, ca:fs.readFileSync('ca.crt')
    // });
    // subscribing to topic dripo/ on connect
    client.on('connect', function() {
        client.subscribe('dripo/#',{ qos: 1});
        client.subscribe('gateway/#',{qos:1});
    });

    //Socket.io Config for forwarding message to connected device
    io.on('connection', function (socket) {
       // when socket connection publishes a message, forward that message the the mqtt broker
      socket.on('publish', function (data) {
          client.publish(data.topic,data.message,{ qos: 1, retain: false});
      });

    });
    
  

    //cron job to check whether device is offline
    cron.schedule('0-59 * * * *', function(){
        Dripo.find({monitor:true,status:'ongoing'}).exec(function (err,dripo) {
            if(err){
                //console.log(err);
            }
            else{
                var date = new Date();
                var minutes = date.getMinutes()
                for(var key in dripo){
                    if(Math.abs((dripo[key].lastMessageMin -minutes)) > 4){
                        client.publish('dripo/' + dripo[key].dripoId+"/will" ,"offline",function (err) {
                            if(err){
                                //console.log(err);
                            }
                        })                    }
                }
            }
        })
    });



   
   
    //function fired on recieving a message from device in topic dripo/
    client.on('message', function (topic, message) {
        var topicinfoArray = topic.split("/");
        if(topicinfoArray[0] == 'dripo'){
            var dripoId = topicinfoArray[1];
            var topic = 'dripo/'+dripoId+'/';
            var deviceId = dripoId;
            Dripo.findOne({dripoId:deviceId}).exec(function(err,dripo){
                if(err){
                    console.log(err);
                }
                if(!dripo){
                        client.publish('error/' + deviceId ,"Device&Not&Added",function (err) {
                            if(err){
                                console.log(err);
                            }
                        })
                }
                else{
                    var stationId=dripo._station.toString();
                    var stationid = ObjectId(stationId);
                    var id = dripo._id.toString();
                    //code to send beds in a station to device requesting it
                    if(topicinfoArray[2]=='req'){
                        Bed.find({_station:stationId}).sort({bedName:1}).exec(function (err,bed) {
                            if(err) {
                                console.log(err);
                            }
                            if(bed.length == 0){
                                client.publish('error/' + deviceId ,"Bed&Not&Added",function (err) {
                                    if(err){
                                        console.log(err);
                                    }
                                })
                            }
                            else{
                                var pubBed=[];
                                for (var key2 in bed)
                                {
                                    pubBed.push(bed[key2].bedName); 
                                    pubBed.push('&'); 
                                    pubBed.push(bed[key2].bedName); 
                                    pubBed.push('&');  
                                }
                                var pub_bed=pubBed.join('');
                                client.publish('dripo/' + deviceId + '/bed',pub_bed,{ qos: 1, retain: true });
                            }
                        })
                    }

                    //code to handle monitoring messages from device
                    if(topicinfoArray[2]=='mon' || topicinfoArray[2]=='will'){
                        var msg = message.toString();
                        var messageArray = msg.split("-");
                        var status = messageArray[0];
                        var bedName = messageArray[1];
                        var rate = messageArray[2];
                        var infusedVolume = messageArray[3];
                        var totalVolume = messageArray[4];
                        var deviceCharge = messageArray[5];
                        var messageNumber = messageArray[6];
                        var infusionDate= new Date();
                        var date = new Date();
                        var hours = date.getHours();
                        var minutes = date.getMinutes()
                        var ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12; // the hour '0' should be '12'
                        minutes = minutes < 10 ? '0'+minutes : minutes;
                        var infusionTime = hours + ':' + minutes + ' ' + ampm;
                        var dateObj = new Date();
                        var month = dateObj.getUTCMonth() + 1; //months from 1-12
                        var day = dateObj.getUTCDate();
                        var year = dateObj.getUTCFullYear();
                        var newDate = day + "/" + month + "/" + year;
                        var timeRemaining=Math.floor(((totalVolume - infusedVolume)/rate)*60);
                        var percentage= Math.floor((infusedVolume/totalVolume) *100);
                        if(status == 'I' && messageNumber == 0){
                            Bed.findOne({bedName:bedName,_station:stationid}).exec(function(err,bed){
                                if(err) {
                                    console.log(err);
                                }
                                Infusionhistory.collection.update({dripoId:deviceId},{$set:{endingTime:infusionTime,dripoId:""}},{upsert:false}); 
                                Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                                    dripo.monitor=true;
                                    dripo.status = 'ongoing';
                                    dripo.topic = topic;
                                    dripo.infusionStatus = 'Infuing'
                                    dripo.rate = rate;
                                    dripo.infusedVolume = infusedVolume;
                                    dripo.totalVolume = totalVolume;
                                    dripo.timeRemaining = timeRemaining;
                                    dripo.lastMessageMin = minutes;
                                    dripo.deviceCharge = deviceCharge;
                                    dripo.percentage = percentage;
                                    dripo.bedName = bedName;
                                    dripo.save(function (err) {
                                        if(err){
                                            console.log(err);
                                        }
                                        else{
                                            var inf = new Infusionhistory();
                                            inf.date = newDate;
                                            inf.bedName = bedName;
                                            inf.infusionDate = infusionDate;
                                            inf.startingTime = infusionTime;
                                            inf.dripoId = deviceId;
                                            inf._station = stationid;
                                            inf.infusedVolume = infusedVolume;
                                            inf.totalVolume = totalVolume;
                                            inf.save(function (err) {
                                                if(err){
                                                    console.log(err);
                                                }
                                                else{
                                                   io.emit('dripo',{
                                                        'bedName': bedName,
                                                        'topic':topic.toString(),
                                                        'dripoId':deviceId,
                                                        'infusionStatus':'Start',
                                                        'monitor':true,
                                                        'status':'ongoing',
                                                        'rate':rate,
                                                        '_id':id,
                                                        'infusedVolume':infusedVolume,
                                                        'totalVolume':totalVolume,
                                                        'timeRemaining':timeRemaining,
                                                        'percentage':percentage,
                                                        'deviceCharge':deviceCharge,
                                                    }); 
                                                }
                                            })


                                        }
                                    })

                                });   
                        
                            });

                        }//end of started
                        else if(status == 'I' && messageNumber != 0){
                            Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                            dripo.monitor=true;
                            dripo.status = 'ongoing';
                            dripo.infusionStatus = 'Infuing'
                            dripo.rate = rate;
                            dripo.infusedVolume = infusedVolume;
                            dripo.totalVolume = totalVolume;
                            dripo.timeRemaining = timeRemaining;
                            dripo.lastMessageMin = minutes;
                            dripo.deviceCharge = deviceCharge;
                            dripo.percentage = percentage;
                            dripo.save(function (err) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{message:{status:'Infusing',time:infusionTime}}},{upsert:false});
                                    Infusionhistory.collection.update({dripoId:dripoId},{$set:{infusedVolume:infusedVolume}},{upsert:false}); 
 
                                    io.emit('dripo',{
                                        'bedName': bedName,
                                        'topic':topic.toString(),
                                        'dripoId':deviceId,
                                        'monitor':true,
                                        'infusionStatus':'Infusing',
                                        'status':'ongoing',
                                        'rate':rate,
                                        '_id':id,
                                        'infusedVolume':infusedVolume,
                                        'totalVolume':totalVolume,
                                        'timeRemaining':timeRemaining,
                                        'percentage':percentage,
                                        'deviceCharge':deviceCharge,
                                    }); 


                                }
                             })

                             });  
                            
                        }

                        else if(status== 'B'){

                            Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                            dripo.monitor=true;
                            dripo.status = 'alerted';
                            dripo.infusionStatus = 'Blocked'
                            dripo.rate = 0;
                            dripo.infusedVolume = infusedVolume;
                            dripo.totalVolume = totalVolume;
                            dripo.timeRemaining = timeRemaining;
                            dripo.lastMessageMin = minutes;
                            dripo.deviceCharge = deviceCharge;
                            dripo.percentage = percentage;
                            dripo.save(function (err) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{message:{status:'Blocked',time:infusionTime}}},{upsert:false}); 
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{error:{status:'Blocked',time:infusionTime}}},{upsert:false}); 
                                    Infusionhistory.collection.update({dripoId:dripoId},{$set:{infusedVolume:infusedVolume}},{upsert:false}); 
                                    io.emit('dripo',{
                                        'bedName': bedName,
                                        'topic':topic.toString(),
                                        'dripoId':deviceId,
                                        'monitor':true,
                                        'infusionStatus':'Blocked',
                                        'status':'alerted',
                                        'rate':0,
                                        '_id':id,
                                        'infusedVolume':infusedVolume,
                                        'totalVolume':totalVolume,
                                        'timeRemaining':timeRemaining,
                                        'percentage':percentage,
                                        'deviceCharge':deviceCharge,
                                    }); 


                                }
                             })

                             });  
                            
                        }
                        else if(status == 'offline'){
                            Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                            dripo.monitor=false;
                            dripo.status = 'offline';
                            dripo.bedName="";
                            dripo.infusionStatus="Ended";
                            dripo.rate = 0;
                            dripo.infusedVolume = 0;
                            dripo.totalVolume = 0;
                            dripo.timeRemaining = 0;
                            dripo.lastMessageMin = minutes;
                            dripo.percentage = 0;
                            dripo.save(function (err) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{message:{status:'Ended',time:infusionTime}}},{upsert:false});                        
                                    Infusionhistory.collection.update({dripoId:dripoId},{$set:{endingTime:infusionTime,dripoId:""}},{upsert:false}); 
                                    io.emit('dripo',{
                                        'bedName': bedName,
                                        'topic':topic.toString(),
                                        'dripoId':deviceId,
                                        'monitor':false,
                                        'infusionStatus':'Ended',
                                        'status':'',
                                        'rate':0,
                                        '_id':id,
                                        'infusedVolume':0,
                                        'totalVolume':0,
                                        'timeRemaining':0,
                                        'percentage':0,
                                        'deviceCharge':deviceCharge,
                                    }); 


                                }
                             })

                             });  
                        }



                    }//end of mon





                       
                }//end of device linked with station

                    
            });//end of find dripo

        }//end of "dripo/#"

        //code for LoRa Devices**************************************************************

        if(topicinfoArray[0] == 'gateway'){
            var gatewayId = topicinfoArray[1];
            var msg = message.toString();
            var messageArray = msg.split("-");
            var deviceId = messageArray[0];
            var type=messageArray[1];
            Dripo.findOne({dripoId:deviceId}).exec(function(err,dripo){
                if(err){
                    console.log(err);
                }
                if(!dripo){
                        client.publish('error/' + gatewayId ,"Device&Not&Added",function (err) {
                            if(err){
                                console.log(err);
                            }
                        })
                }
                else{

                    var stationId=dripo._station.toString();
                    var stationid = ObjectId(stationId);
                    var id = dripo._id.toString();
                    //code to send beds in a station to device requesting it
                    if(type=='bedreq'){
                        Bed.find({_station:stationId}).sort({bedName:1}).exec(function (err,bed) {
                            if(err) {
                                console.log(err);
                            }
                            if(bed.length == 0){
                                client.publish('error/' + gatewayId ,"Bed&Not&Added",function (err) {
                                    if(err){
                                        console.log(err);
                                    }
                                })
                            }
                            else{
                                var pubBed=[];
                                for (var key2 in bed)
                                {
                                    pubBed.push(bed[key2].bedName); 
                                    pubBed.push('&'); 
                                }
                                var pub_bed=pubBed.join('');
                                client.publish('gateway/' + gatewayId + '/bed',dripo.dripoId+"-"+pub_bed,{ qos: 1, retain: true });
                            }
                        })
                    }//end of bed req

                    if(type!='bedreq'){
                        var msg = message.toString();
                        var messageArray = msg.split("-");
                        var deviceId = messageArray[0];
                        var status = messageArray[1];
                        var bedName = messageArray[2];
                        var rate = messageArray[3];
                        var infusedVolume = messageArray[4];
                        var totalVolume = messageArray[5];
                        var deviceCharge = messageArray[6];
                        var messageNumber = messageArray[7];
                        var infusionDate= new Date();
                        var date = new Date();
                        var hours = date.getHours();
                        var minutes = date.getMinutes()
                        var ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12; // the hour '0' should be '12'
                        minutes = minutes < 10 ? '0'+minutes : minutes;
                        var infusionTime = hours + ':' + minutes + ' ' + ampm;
                        var dateObj = new Date();
                        var month = dateObj.getUTCMonth() + 1; //months from 1-12
                        var day = dateObj.getUTCDate();
                        var year = dateObj.getUTCFullYear();
                        var newDate = day + "/" + month + "/" + year;
                        var timeRemaining =  Math.floor(((totalVolume - infusedVolume)/rate)*60);
                        var percentage= Math.floor((infusedVolume/totalVolume) *100);
                        
                        if(status == 'I' && messageNumber == 0){
                            Bed.findOne({bedName:bedName,_station:stationid}).exec(function(err,bed){
                                if(err) {
                                    console.log(err);
                                }
                                Infusionhistory.collection.update({dripoId:deviceId},{$set:{endingTime:infusionTime,dripoId:""}},{upsert:false}); 
                                Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                                    dripo.monitor=true;
                                    dripo.status = 'ongoing';
                                    dripo.topic = topic;
                                    dripo.infusionStatus = 'Infuing'
                                    dripo.rate = rate;
                                    dripo.infusedVolume = infusedVolume;
                                    dripo.totalVolume = totalVolume;
                                    dripo.timeRemaining = timeRemaining;
                                    dripo.lastMessageMin = minutes;
                                    dripo.deviceCharge = deviceCharge;
                                    dripo.percentage = percentage;
                                    dripo.bedName = bedName;
                                    dripo.save(function (err) {
                                        if(err){
                                            console.log(err);
                                        }
                                        else{
                                            var inf = new Infusionhistory();
                                            inf.date = newDate;
                                            inf.bedName = bedName;
                                            inf.infusionDate = infusionDate;
                                            inf.startingTime = infusionTime;
                                            inf.dripoId = deviceId;
                                            inf._station = stationid;
                                            inf.infusedVolume = infusedVolume;
                                            inf.totalVolume = totalVolume;
                                            inf.save(function (err) {
                                                if(err){
                                                    console.log(err);
                                                }
                                                else{
                                                   io.emit('dripo',{
                                                        'bedName': bedName,
                                                        'topic':topic.toString(),
                                                        'dripoId':deviceId,
                                                        'infusionStatus':'Start',
                                                        'monitor':true,
                                                        'status':'ongoing',
                                                        'rate':rate,
                                                        '_id':id,
                                                        'infusedVolume':infusedVolume,
                                                        'totalVolume':totalVolume,
                                                        'timeRemaining':0,
                                                        'percentage':percentage,
                                                        'deviceCharge':deviceCharge,
                                                    }); 
                                                   console.log("emited");
                                                }
                                            })


                                        }
                                    })

                                });   
                        
                            });

                        }//end of started

                        else if(status == 'I' && messageNumber != 0){
                            Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                            dripo.monitor=true;
                            dripo.status = 'ongoing';
                            dripo.infusionStatus = 'Infuing'
                            dripo.rate = rate;
                            dripo.infusedVolume = infusedVolume;
                            dripo.totalVolume = totalVolume;
                            dripo.timeRemaining = timeRemaining;
                            dripo.lastMessageMin = minutes;
                            dripo.deviceCharge = deviceCharge;
                            dripo.percentage = percentage;
                            dripo.save(function (err) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{message:{status:'Infusing',time:infusionTime}}},{upsert:false});
                                    Infusionhistory.collection.update({dripoId:dripoId},{$set:{infusedVolume:infusedVolume}},{upsert:false}); 
 
                                    io.emit('dripo',{
                                        'bedName': bedName,
                                        'topic':topic.toString(),
                                        'dripoId':deviceId,
                                        'monitor':true,
                                        'infusionStatus':'Infusing',
                                        'status':'ongoing',
                                        'rate':rate,
                                        '_id':id,
                                        'infusedVolume':infusedVolume,
                                        'totalVolume':totalVolume,
                                        'timeRemaining':timeRemaining,
                                        'percentage':percentage,
                                        'deviceCharge':deviceCharge,
                                    }); 


                                }
                             })

                             });  
                            
                        }

                        else if(status== 'B'){

                            Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                            dripo.monitor=true;
                            dripo.status = 'alerted';
                            dripo.infusionStatus = 'Blocked'
                            dripo.rate = 0;
                            dripo.infusedVolume = infusedVolume;
                            dripo.totalVolume = totalVolume;
                            dripo.timeRemaining = timeRemaining;
                            dripo.lastMessageMin = minutes;
                            dripo.deviceCharge = deviceCharge;
                            dripo.percentage = percentage;
                            dripo.save(function (err) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{message:{status:'Blocked',time:infusionTime}}},{upsert:false}); 
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{error:{status:'Blocked',time:infusionTime}}},{upsert:false}); 
                                    Infusionhistory.collection.update({dripoId:dripoId},{$set:{infusedVolume:infusedVolume}},{upsert:false}); 
                                    io.emit('dripo',{
                                        'bedName': bedName,
                                        'topic':topic.toString(),
                                        'dripoId':deviceId,
                                        'monitor':true,
                                        'infusionStatus':'Blocked',
                                        'status':'alerted',
                                        'rate':0,
                                        '_id':id,
                                        'infusedVolume':infusedVolume,
                                        'totalVolume':totalVolume,
                                        'timeRemaining':timeRemaining,
                                        'percentage':percentage,
                                        'deviceCharge':deviceCharge,
                                    }); 


                                }
                             })

                             });  
                            
                        }//end of block

                        else if(status == 'O'){
                            Dripo.findOne({dripoId:deviceId}).exec(function (err,dripo) {
                            dripo.monitor=false;
                            dripo.status = 'offline';
                            dripo.bedName="";
                            dripo.infusionStatus="Ended";
                            dripo.rate = 0;
                            dripo.infusedVolume = 0;
                            dripo.totalVolume = 0;
                            dripo.timeRemaining = 0;
                            dripo.lastMessageMin = minutes;
                            dripo.percentage = 0;
                            dripo.save(function (err) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    Infusionhistory.collection.update({dripoId:dripoId},{$push:{message:{status:'Ended',time:infusionTime}}},{upsert:false});                        
                                    Infusionhistory.collection.update({dripoId:dripoId},{$set:{endingTime:infusionTime,dripoId:""}},{upsert:false}); 
                                    io.emit('dripo',{
                                        'bedName': bedName,
                                        'topic':topic.toString(),
                                        'dripoId':deviceId,
                                        'monitor':false,
                                        'infusionStatus':'Ended',
                                        'status':'',
                                        'rate':0,
                                        '_id':id,
                                        'infusedVolume':0,
                                        'totalVolume':0,
                                        'timeRemaining':0,
                                        'percentage':0,
                                        'deviceCharge':deviceCharge,
                                    }); 


                                }
                             })

                             });  
                        }//end of offline

                    }



                }
            });

        }


    });//end of on message


   

    return io
}

