var socketio = require('socket.io');
var mqtt = require('mqtt')
var ObjectId = require('mongodb').ObjectID;
var cron = require('node-cron');


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
    // subscribing to topic dripo/ on connect
    client.on('connect', function() {
        client.subscribe('dripo/#',{ qos: 1});
    });

    //Socket.io Config for forwarding message to connected device
    io.on('connection', function (socket) {
       // when socket connection publishes a message, forward that message the the mqtt broker
      socket.on('publish', function (data) {
          client.publish(data.topic,data.message,{ qos: 1, retain: false});
      });

    });
    sendBeds();
    sendIVsets();
    //function to send all bed names 
    function sendBeds() {
        Station.find({}).exec(function (err,station) {
            if(err){
                console.log(err);
            }
            station.forEach(function (stationObj) {
                var stationid = stationObj._id.toString();
                Bed.find({_station:stationid}).sort({bedName:1}).exec(function (err,bed) {
                    if(err) {
                        console.log(err);
                    }
                    if(bed.length == 0){
                        client.publish('dripo/'+stationid+'/allbed',' &',{ qos: 1, retain: true});

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
                        client.publish('dripo/' + stationid + '/allbed',pub_bed,{ qos: 1, retain: true });

                    }
                })

            })
        });

    }

    //To send IVset details to all station
    function sendIVsets() {
        Station.find({}).exec(function (err,station) {    
            if(err){
                console.log(err);
            }
            station.forEach(function (stationObj) {
                var stationid = stationObj._id.toString();
                Ivset.find({admin:stationObj.admin}).sort({ivsetdpf:1}).exec(function(err,ivset){
                    if(err) {
                        console.log(err);
                    }
                    if(ivset.length == 0){
                        client.publish('dripo/'+stationid+'/df',' &',{ qos: 1, retain: true});
                    }
                    else{

                        var pub_dff=[];
                        for (var key2 in ivset){
                            pub_dff.push(ivset[key2].ivsetDpf); 
                            pub_dff.push('&');
                            pub_dff.push(ivset[key2].ivsetDpf); 
                            pub_dff.push('&');  
                        }
                        var pub_df=pub_dff.join('');
                        client.publish('dripo/' + stationid+ '/df',pub_df,{ qos: 1, retain: true });

                    }

                })

            })
        
      })
    }

    //cron job to set upcoming task to delayed
    cron.schedule('59 * * * *', function(){
      var date = new Date();
      var hour = date.getHours();
      Task.collection.updateMany({'time':hour,'status':'upcoming'},{$set:{status:'delayed'}});
    });



    var methods = {
        updateBeds: function(station) {
            stationid = station;
            Bed.find({_station:ObjectId(stationid)}).sort({bedName:1}).exec(function (err,bed) {
                if(err) throw err;
                if(bed.length == 0){
                    client.publish('dripo/'+stationid+'/allbed',' &',{ qos: 1, retain: true});

                }
                else{
                    var pubBed=[];
                    for (var key in bed)
                    {
                      pubBed.push(bed[key].bedName); 
                      pubBed.push('&'); 
                      pubBed.push(bed[key].bedName); 
                      pubBed.push('&');  
                    }
                    var pub_bed=pubBed.join('');
                    client.publish('dripo/' + stationid + '/allbed',pub_bed,{ qos: 1, retain: true});

                }
            })
        },
        updateIvsets: function(admin) {
            Station.find({admin:admin}).exec(function (err,station) {    
                if(err){
                    console.log(err);
                }
                station.forEach(function (stationObj) {
                var stationid = stationObj._id.toString();
                Ivset.find({admin:stationObj.admin}).sort({ivsetdpf:1}).exec(function(err,ivset){
                    if(err) {
                        console.log(err);
                    }
                    if(ivset.length == 0){
                        client.publish('dripo/'+stationid+'/df',' &',{ qos: 1, retain: true});
                    }
                    else{
                        var pub_dff=[];
                        for (var key2 in ivset){
                            pub_dff.push(ivset[key2].ivsetDpf); 
                            pub_dff.push('&');
                            pub_dff.push(ivset[key2].ivsetDpf); 
                            pub_dff.push('&');  
                        }
                        var pub_df=pub_dff.join('');
                        client.publish('dripo/' + stationid+ '/df',pub_df,{ qos: 1, retain: true });

                    }

                })

                })
              
            })

        }

    };
    exports.data = methods;

   
    //function fired on recieving a message from device in topic dripo/
    client.on('message', function (topic, message) {
        var topicinfoArray = topic.split("/");
        var dripoId = topicinfoArray[1];
        var commonTopic = 'dripo/'+dripoId+'/';
        //to send station id back to requested device
        if(topicinfoArray[1]=='station'){
            var deviceId = message.toString();
            Dripo.findOne({dripoId:deviceId}).exec(function(err,dripo){
                if(err){
                    console.log(err);
                }
                if(!dripo){
                   console.log(deviceId+" not linked with any stations");
                }
                else{
                    var stationId=dripo._station.toString();
                    client.publish('dripo/' + deviceId +'/station' ,stationId,function (err) {
                        if(err){
                            console.log(err);
                        }
                    });


                }

                
            });

        }
        else if(topicinfoArray[2]=='createtask_req'){
            var msg = message.toString();
            var msgArray = msg.split("-");
            var bedName = msgArray[0];
            var stationValid = ObjectId.isValid(msgArray[1]);
            if(stationValid){
                var stationid = ObjectId(msgArray[1]);
                var totalVolume = msgArray[2];
                Bed.findOne({bedName:bedName,_station:stationid}).exec(function(err,bed){
                    if(err) {
                        console.log(err);
                    }
                    if(bed.length != 0){
                        if(bed.status=='occupied'){
                            var medicationObj = new Medication();
                            medicationObj.medicineName = 'unknown';
                            medicationObj.medicineRate = 10;
                            medicationObj.medicineVolume = totalVolume;
                            medicationObj.stationName = bed.stationName;
                            medicationObj._bed = ObjectId(bed._id);
                            medicationObj._patient = ObjectId(bed._patient);
                            medicationObj.source = 'dripo';
                            bedid= ObjectId(bed._id);
                            patientid =  ObjectId(bed._patient);
                            medicationObj.save(function (err,medcb) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    Patient.collection.update({_id:medcb._patient},{$push:{_medication:medcb._id}},{upsert:true});
                                    var timeObj = new Task();
                                    timeObj.time=new Date().getHours();
                                    timeObj.status='infusion';
                                    timeObj.priority = 0;
                                    timeObj.status='opened';
                                    timeObj.createdAt=new Date();
                                    timeObj.infusedVolume =0;
                                    timeObj.totalVolume =totalVolume;
                                    timeObj._patient=patientid;
                                    timeObj._bed=bedid;
                                    timeObj._medication=ObjectId(medcb._id);
                                    timeObj._station=ObjectId(bed._station);
                                    timeObj.save(function (err,timecb) {
                                        if(err){
                                            console.log(err);
                                        }
                                        else{
                                            Medication.collection.update({_id:ObjectId(medcb._id)},{$push:{_task:timecb._id}},{upsert:true});
                                            var pub_cretask=timecb._id.toString();
                                            client.publish('dripo/' + dripoId + '/createtask_reply',pub_cretask,{ qos: 1, retain: false });  

                                        }
                                    });


                                     
                                }
                            });
                        }
                        if(bed.status=='unoccupied'){
                          var pat = new Patient();
                          var dateObj = new Date();
                          var month = dateObj.getUTCMonth() + 1; //months from 1-12
                          var day = dateObj.getUTCDate();
                          var year = dateObj.getUTCFullYear();
                          var newDate = day + "/" + month + "/" + year;
                          var date = new Date();
                          var hours = date.getHours();
                          var minutes = date.getMinutes()
                          var ampm = hours >= 12 ? 'PM' : 'AM';
                          hours = hours % 12;
                          hours = hours ? hours : 12; // the hour '0' should be '12'
                          minutes = minutes < 10 ? '0'+minutes : minutes;
                          var strTime = hours + ':' + minutes + ' ' + ampm;
                            pat.patientName = bedName+' '+newDate+' '+strTime;
                            pat._station = stationid;
                            pat.patientStatus = 'discharged';
                            pat.save(function (err,patcb) {
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    var medicationObj = new Medication();
                                    medicationObj.medicineName = 'unknown';
                                    medicationObj.medicineRate = 10;
                                    medicationObj.medicineVolume = totalVolume;
                                    medicationObj.stationName = bed.stationName;
                                    medicationObj._bed = ObjectId(bed._id);
                                    medicationObj._patient = ObjectId(patcb._id);
                                    medicationObj.source = 'dripo';
                                    bedid= ObjectId(bed._id);
                                    patientid =  ObjectId(bed._patient);
                                    medicationObj.save(function (err,medcb) {
                                        if(err){
                                            console.log(err);
                                        }
                                        else{
                                            Patient.collection.update({_id:medcb._patient},{$push:{_medication:medcb._id}},{upsert:true});
                                            var timeObj = new Task();
                                            timeObj.time=new Date().getHours();
                                            timeObj.status='infusion';
                                            timeObj.priority = 0;
                                            timeObj.status='opened';
                                            timeObj.createdAt=new Date();
                                            timeObj.infusedVolume =0;
                                            timeObj.totalVolume =totalVolume;
                                            timeObj._patient=patientid;
                                            timeObj._bed=bedid;
                                            timeObj._medication=ObjectId(medcb._id);
                                            timeObj._station=ObjectId(bed._station);
                                            timeObj.save(function (err,timecb) {
                                                if(err){
                                                    console.log(err);
                                                }
                                                else{
                                                    Medication.collection.update({_id:ObjectId(medcb._id)},{$push:{_task:timecb._id}},{upsert:true});
                                                    var pub_cretask=timecb._id.toString();
                                                    client.publish('dripo/' + dripoId + '/createtask_reply',pub_cretask,{ qos: 1, retain: false });  

                                                }
                                            });


                                             
                                        }
                                    });
                                }
                            })

                        }
                       
                    }

                });

            }           

        }
        else if(topicinfoArray[2] == 'mon'){
            Dripo.findOne({dripoId:dripoId}).exec(function(err,dripo){
                if(err) throw err;
                if(!dripo){
                    if(topicinfoArray[2] != 'will'){
                        client.publish('error/' + dripoid ,'Access Denied',function (err) {
                            if(err){
                                console.log(err);
                            }
                        });
                    }
                   
                }
                else{
                    var stationId = dripo._station;
                    var msg = message.toString();
                    var messageArray = msg.split("-");
                    var taskId = messageArray[0];
                    var status = messageArray[1];
                    var rate = messageArray[2];
                    var infusedVolume = messageArray[3];
                    var timeRemaining = messageArray[4];
                    var totalVolume = messageArray[5];
                    var deviceCharge = messageArray[6];
                    var dropCount = messageArray[7];
                    var taskValid = ObjectId.isValid(taskId);
                    var percentage = Math.trunc(((infusedVolume/totalVolume)*100));
                    var infusionDate= new Date();
                    // var infusionTime=(new Date()).getHours()+':'+(new Date()).getMinutes()+':'+(new Date()).getSeconds();
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

                    if(status == 'start' && taskValid){
                        var newRate=Number(rate)+1;
                        //Medication.collection.update({_task:ObjectId(taskId)},{$set:{medicinerate:newRate}},{upsert:true}); 
                        Medication.findOne({_task: ObjectId(taskId)}).populate({path:'_bed',model:'Bed'}).exec(function (err,med) {
                            if(err){
                                console.log(err);
                            }
                            if(!med){
                                console.log("No medicine found");
                            }
                            else{
                                med.medicineRate = newRate;
                                med.save(function(err) {
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        io.emit('dripo',{
                                            '_bed':{'bedName':med._bed.bedName},
                                            '_medication':{'medicineRate':newRate,medicineVolume:med.medicineVolume},
                                            'topic':topic.toString(),
                                            'message':message.toString(),
                                            'infusionStatus':'Start',
                                            'status':'ongoing',
                                            '_id':taskId,
                                            'rate':newRate,
                                            'infusedVolume':infusedVolume,
                                            'timeRemaining':timeRemaining,
                                            'totalVolume':totalVolume,
                                            'percentage':percentage,
                                            'deviceCharge':deviceCharge,
                                            'topic':commonTopic
                                        });
                                        //Task.collection.update({_id:ObjectId(taskId)},{$set:{status:'ongoing',rate:newRate,infusedVolume:infusedVolume,timeRemaining:timeRemaining,totalVolume:totalVolume,percentage:percentage,infusionStatus:status,topic:commonTopic,deviceCharge:deviceCharge}});
                                        // Medication.collection.update({_id:ObjectId(medid),source:'dripo'},{$set:{medicinerate:rate}},{upsert:true});    
                                        Task.findOne({_id: ObjectId(taskId)}).exec(function (err,task) {
                                            if(err){
                                                console.log(err);
                                            }
                                            if(!task){
                                                console.log("No task found");
                                            }
                                            else{
                                                task.status='ongoing';
                                                task.rate = newRate;
                                                task.infusedVolume = infusedVolume;
                                                task.timeRemaining = timeRemaining;
                                                task.totalVolume = totalVolume;
                                                task.percentage = percentage;
                                                task.infusionStatus = 'Start';
                                                task.deviceCharge = deviceCharge;
                                                task.topic = commonTopic;
                                                task.save(function(err) {
                                                    if(err){
                                                        console.log(err);
                                                    }
                                                    else{
                                                        Infusionhistory.findOne({_task:taskId,date:newDate}).exec(function(err,inf){
                                                            if(err){
                                                                console.log(err);
                                                            }
                                                            if(!inf){
                                                                var infObj = new Infusionhistory();
                                                                infObj.date = newDate;
                                                                infObj.startingTime = infusionTime;
                                                                infObj.infusionDate = infusionDate;
                                                                infObj.error = [];
                                                                infObj._task = ObjectId(taskId);
                                                                infObj.dripoId = dripoId;
                                                                infObj.save(function (err,infcb) {
                                                                    if(err){
                                                                        console.log(err);
                                                                    }
                                                                    else{
                                                                        Task.findOne({_id:ObjectId(taskId)}).exec(function(err,task) {
                                                                            if(err) {
                                                                                console.log(err);
                                                                            }
                                                                            else{
                                                                                Medication.collection.update({_id:ObjectId(task._medication)},{$push:{_infusionhistory:infcb._id}},{upsert:true});    
                                                                                Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:status,time:infusionTime}}},{upsert:true}); 

                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                                
                                                            }
                                                        });

                                                    }
                                                })


                                            }
                                        })

  

                                    }
                                })

                            }
                        })


                       

                    } //end of if status is start
                    else if(status == 'infusing' && taskValid){
                        io.emit('dripo',{
                            'topic':topic.toString(),
                            'message':message.toString(),
                            'infusionStatus':'Infusing',
                            'status':'ongoing',
                            '_id':taskId,
                            'rate':rate,
                            'infusedVolume':infusedVolume,
                            'timeRemaining':timeRemaining,
                            'totalVolume':totalVolume,
                            'percentage':percentage,
                            'deviceCharge':deviceCharge,
                            'topic':commonTopic

                        });
                        Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:status,time:infusionTime}}},{upsert:false}); 
                        Task.collection.update({_id:ObjectId(taskId)},{$set:{status:'ongoing',rate:rate,infusedVolume:infusedVolume,timeRemaining:timeRemaining,totalVolume:totalVolume,percentage:percentage,infusionStatus:'Infusing',deviceCharge:deviceCharge}});
                    

                    }//end of if status is infusing

                    else if(status == 'Block' && taskValid){
                        Task.findOne({_id: ObjectId(taskId)}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).exec(function (err,task) {
                            if(err){
                                console.log(err);
                            }
                            if(!task){
                                console.log("No task found");
                            }
                            else{
                                io.emit('dripo',{
                                    '_bed':{'bedName':task._bed.bedName},
                                    '_medication':{'medicineRate':task._medication.medicineRate,medicineVolume:task._medication.medicineVolume},
                                    'topic':topic.toString(),
                                    'message':message.toString(),
                                    'infusionStatus':'Block',
                                    'status':'alerted',
                                    '_id':taskId,
                                    'rate':rate,
                                    'infusedVolume':infusedVolume,
                                    'timeRemaining':timeRemaining,
                                    'totalVolume':totalVolume,
                                    'percentage':percentage,
                                    'deviceCharge':deviceCharge,
                                    'topic':commonTopic

                                });
                                task.status='alerted';
                                task.rate = rate;
                                task.infusedVolume = infusedVolume;
                                task.timeRemaining = timeRemaining;
                                task.totalVolume = totalVolume;
                                task.percentage = percentage;
                                task.infusionStatus = 'Block';
                                task.deviceCharge = deviceCharge;
                                task.save(function(err) {
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:'Block',time:infusionTime}}},{upsert:false}); 
                                        Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{error:{status:'Block',time:infusionTime}}},{upsert:false}); 

                                    }
                                })
                            }
                        });                    

                    }//end of if status is Block
                    else if(status == 'Rate_Err' && taskValid){
                        Task.findOne({_id: ObjectId(taskId)}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).exec(function (err,task) {
                            if(err){
                                console.log(err);
                            }
                            if(!task){
                                console.log("No task found");
                            }
                            else{
                                io.emit('dripo',{
                                    '_bed':{'bedName':task._bed.bedName},
                                    '_medication':{'medicineRate':task._medication.medicineRate,medicineVolume:task._medication.medicineVolume},
                                    'topic':topic.toString(),
                                    'message':message.toString(),
                                    'infusionStatus':'Rate Error',
                                    'status':'alerted',
                                    '_id':taskId,
                                    'rate':rate,
                                    'infusedVolume':infusedVolume,
                                    'timeRemaining':timeRemaining,
                                    'totalVolume':totalVolume,
                                    'percentage':percentage,
                                    'deviceCharge':deviceCharge,
                                    'topic':commonTopic

                                });
                                task.status='alerted';
                                task.rate = rate;
                                task.infusedVolume = infusedVolume;
                                task.timeRemaining = timeRemaining;
                                task.totalVolume = totalVolume;
                                task.percentage = percentage;
                                task.infusionStatus = 'Rate Error';
                                task.deviceCharge = deviceCharge;
                                task.save(function(err) {
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:'Rate Error',time:infusionTime}}},{upsert:false}); 
                                        Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{error:{status:'Block',time:infusionTime}}},{upsert:false}); 

                                    }
                                })
                            }
                        });                    

                    }//end of if status is Rate_Err
                    else if(status == 'Complete' && taskValid){
                        Task.findOne({_id: ObjectId(taskId)}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).exec(function (err,task) {
                            if(err){
                                console.log(err);
                            }
                            if(!task){
                                console.log("No task found");
                            }
                            else{
                                io.emit('dripo',{
                                    '_bed':{'bedName':task._bed.bedName},
                                    '_medication':{'medicineRate':task._medication.medicineRate,medicineVolume:task._medication.medicineVolume},
                                    'topic':topic.toString(),
                                    'message':message.toString(),
                                    'infusionStatus':'Almost Done',
                                    'status':'alerted',
                                    '_id':taskId,
                                    'rate':rate,
                                    'infusedVolume':infusedVolume,
                                    'timeRemaining':timeRemaining,
                                    'totalVolume':totalVolume,
                                    'percentage':percentage,
                                    'deviceCharge':deviceCharge,
                                    'topic':commonTopic


                                });
                                task.status='alerted';
                                task.rate = rate;
                                task.infusedVolume = infusedVolume;
                                task.timeRemaining = timeRemaining;
                                task.totalVolume = totalVolume;
                                task.percentage = percentage;
                                task.infusionStatus = 'Almost Done';
                                task.deviceCharge = deviceCharge;
                                task.save(function(err) {
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:'Almost Done',time:infusionTime}}},{upsert:false}); 

                                    }
                                })

                            }
                        })             

                    }//end of complete

                    else if(status == 'Empty' && taskValid){
                        Task.findOne({_id: ObjectId(taskId)}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).exec(function (err,task) {
                            if(err){
                                console.log(err);
                            }
                            if(!task){
                                console.log("No task found");
                            }
                            else{
                                io.emit('dripo',{
                                    '_bed':{'bedName':task._bed.bedName},
                                    '_medication':{'medicineRate':task._medication.medicineRate,medicineVolume:task._medication.medicineVolume},
                                    'topic':topic.toString(),
                                    'message':message.toString(),
                                    'infusionStatus':'Done',
                                    'status':'alerted',
                                    '_id':taskId,
                                    'rate':rate,
                                    'infusedVolume':infusedVolume,
                                    'timeRemaining':timeRemaining,
                                    'totalVolume':totalVolume,
                                    'percentage':percentage,
                                    'deviceCharge':deviceCharge,
                                    'topic':commonTopic


                                });
                                task.status='alerted';
                                task.rate = rate;
                                task.infusedVolume = infusedVolume;
                                task.timeRemaining = timeRemaining;
                                task.totalVolume = totalVolume;
                                task.percentage = percentage;
                                task.infusionStatus = 'Done';
                                task.deviceCharge = deviceCharge;
                                task.save(function(err) {
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:'Done',time:infusionTime}}},{upsert:false}); 

                                    }
                                })

                            }
                        })             
                    }//end of if status is Empty

                    else if(status == 'stopp' && taskValid){
                        if(percentage<90){
                            io.emit('dripo',{
                                'topic':topic.toString(),
                                'message':message.toString(),
                                'infusionStatus':'Stop',
                                'status':'alerted',
                                '_id':taskId,
                                'rate':rate,
                                'infusedVolume':infusedVolume,
                                'timeRemaining':timeRemaining,
                                'totalVolume':totalVolume,
                                'percentage':percentage,
                                'deviceCharge':deviceCharge,
                                'topic':commonTopic

                            });
                            Task.collection.remove({_id:ObjectId(taskId)});
                            Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$set:{endingTime:infusionTime,infusedVolume:infusedVolume}},{upsert:false}); 
                            Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:'Stop',time:infusionTime}}},{upsert:false});                        

                        }
                        else{
                            io.emit('dripo',{
                                'topic':topic.toString(),
                                'message':message.toString(),
                                'infusionStatus':'Done',
                                'status':'alerted',
                                '_id':taskId,
                                'rate':rate,
                                'infusedVolume':infusedVolume,
                                'timeRemaining':timeRemaining,
                                'totalVolume':totalVolume,
                                'percentage':percentage,
                                'deviceCharge':deviceCharge,
                                'topic':commonTopic

                            });                            
                            Task.collection.remove({_id:ObjectId(taskId)});
                            Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$set:{endingTime:infusionTime,infusedVolume:infusedVolume}},{upsert:false}); 
                            Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:'Done',time:infusionTime}},endingTime:infusionTime},{upsert:false}); 

                        }
                    }//end of stopp for auto task dripo
                    else if(status == 'Rate_Err_ACK'|| status=='Block_ACK' || status=='Complete_ACK' && taskValid){
                        Task.findOne({_id: ObjectId(taskId)}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).exec(function (err,task) {
                            if(err){
                                console.log(err);
                            }
                            if(!task){
                                console.log("No task found");
                            }
                            else{
                               io.emit('dripo',{
                                    '_bed':{'bedName':task._bed.bedName},
                                    '_medication':{'medicineRate':task._medication.medicineRate,medicineVolume:task._medication.medicineVolume},
                                    'topic':topic.toString(),
                                    'message':message.toString(),
                                    'infusionStatus':'Error_ACK',
                                    'status':'alerted',
                                    '_id':taskId,
                                    'rate':rate,
                                    'infusedVolume':infusedVolume,
                                    'timeRemaining':timeRemaining,
                                    'totalVolume':totalVolume,
                                    'percentage':percentage,
                                    'deviceCharge':deviceCharge,
                                    'topic':commonTopic

                                });
                               task.status='ongoing';
                               task.rate = rate;
                               task.infusedVolume = infusedVolume;
                               task.timeRemaining = timeRemaining;
                               task.totalVolume = totalVolume;
                               task.percentage = percentage;
                               task.infusionStatus = 'Infusing';
                               task.deviceCharge = deviceCharge;
                               task.save(function(err) {
                                   if(err){
                                       console.log(err);
                                   }
                                   
                               })
                            }
                    });
                       
                    }//end of error ack
                     else if(status == 'Empty_ACK' && taskValid){
                         io.emit('dripo',{
                            'topic':topic.toString(),
                            'message':message.toString(),
                            'infusionStatus':'Stop',
                            'status':'alerted',
                            '_id':taskId,
                            'rate':rate,
                            'infusedVolume':infusedVolume,
                            'timeRemaining':timeRemaining,
                            'totalVolume':totalVolume,
                            'percentage':percentage,
                            'deviceCharge':deviceCharge,
                            'topic':commonTopic

                         });
                         Task.collection.remove({_id:ObjectId(taskId)});
                         Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$set:{endingTime:infusionTime,infusedVolume:infusedVolume}},{upsert:false}); 
                         Infusionhistory.collection.update({_task:ObjectId(taskId),date:newDate},{$push:{message:{status:'Done',time:infusionTime}},endingTime:infusionTime},{upsert:false}); 

                     }//end of Empty_ACK


                }//end of else device found

            });

        }//end of mon

    });


   

    return io
}

