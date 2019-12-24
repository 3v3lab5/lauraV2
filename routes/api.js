const express = require('express');
const router = express.Router();
const { check,query , validationResult } = require('express-validator/check');
var jwt = require('jsonwebtoken');
var ip = require('ip');
var ObjectId = require('mongodb').ObjectID;
var socket = require('../lib/sockets');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

//read secrets from .env
var gmailPass = process.env.GMAIL_PASSWORD;
let fromMail = process.env.GMAIL_ID;
var secret = process.env.KEY;

//jwt keys
var privateKey = fs.readFileSync('private.pem');
var publicKey = fs.readFileSync('public.pem');

//models
var User = require('../models/users');
var Station = require('../models/stations');
var Bed = require('../models/beds');
var Ivset = require('../models/ivsets');
var Dripo = require('../models/dripos');
var Patient = require('../models/patients');
var Medication = require('../models/medications');
var Infusionhistory = require('../models/infusionhistories');
var Task = require('../models/tasks');


const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const msg = {
  to: 'rahulaunni@evelabs.co',
  from: 'dripocare@evelabs.co',
  subject: 'Server Restarted',
  text: 'api.dripo.care restarted',
  html: '<strong>Server Restarted</strong>',
};
sgMail.send(msg);


router.post('/register', [check('userName')
    .exists().withMessage("userName is required field")
    .not().isEmpty().withMessage("userName field is empty")
    .isEmail().withMessage("userName should be a valid email id"),
    check('hospitalName')
    .not().isEmpty().withMessage("hospitalName field is empty")
    .exists().withMessage("hospitalName is required field"),
    check('password')
    .exists().withMessage("password is required field")
    .not().isEmpty().withMessage("password field is empty")
    .isLength({ min: 5 }).withMessage("password should be min 5 characters"),
    check('confirmPassword', 'confirmPassword field must have the same value as the password field')
    .not().isEmpty().withMessage("confirmPassword field is empty")
    .exists().withMessage("confirmPassword field is required")
    .custom((value, { req }) => value === req.body.password)], (req, res ,next) => 
    {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
  	//creater user object by fetching values from req.body
  	var user = new User();
  	user.hospitalName = req.body.hospitalName;
  	user.userName = req.body.userName;
  	user.password = req.body.password;
  	//tempToken is used for verification purpose of email
  	user.tempToken = jwt.sign({userName:user.userName,hospitalName:user.hospitalName},secret,{expiresIn:'24h'});
  	//saving user to database
  	user.save(function(err){
  		if (err) {
            return next(err);
  			//responding error back to frontend
  		}
  		else {
  			//to get the host
  			var host=req.get('host');
  			//link for the mail for activation of account
  			var link="http://"+req.get('host')+"/activate/"+user.tempToken; 
  			var ipaddress = ip.address();
  			var offlinelink = "http://localhost:4200/guest/activate/"+user.tempToken; 
            var onlinelink = "https://dripo.care/guest/activate/"+user.tempToken;
            
            const msg = {
                to: 'rahulaunni@evelabs.co',
                from: 'dripocare@evelabs.co',
                subject: 'Verification Link For dripo.care',
                text: '******Verification link for dripo.care***********',                
                html: "Hello "+user.userName+",<br> Please Click on the link to verify your email.<br><a href="+onlinelink+">Click here to verify</a>" ,

            };
            sgMail.send(msg);
            res.status(201).json({success:true,message:'A verification mail has been sent to your email'});
              
            /*
            // auth
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                user: 'dripocare@gmail.com',
                pass: gmailPass
            }
            });

            
            // email options
            let mailOptions = {
                from: fromMail,
                to: user.userName,
                subject: 'Verification Link For dripo.care',
                text: '******Email Contains two type links***********',                
                html: "Hello "+user.userName+",<br> Please Click on the link to verify your email.<br><a href="+onlinelink+">Click here to verify</a><br>Please Click on this link to verify your email if you are registered with our local environement<br><a href="+offlinelink+">Click here to verify</a>" ,

            };

            // send email
            transporter.sendMail(mailOptions, (error, response) => {
            if (error) {
                //console.log(error);
                res.status(201).json({success:false,message:error});

            }
                //console.log(response);
                res.status(201).json({success:true,message:'A verification mail has been sent to your email'});
            });
            */
        }
    });	
});

router.get('/activate', [query('token')
    .exists().withMessage("token field is require")
    .not().isEmpty().withMessage("token field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
        User.findOne({ tempToken: req.query.token }, function(err, user) {
            if (err){
                return next(err);
            }
            else{
                //console.log(user);
                var token = req.query.token; // Save the token from URL for verification 
                // Function to verify the user's token
                jwt.verify(token, secret, function(err, decoded) {
                    if (err) {
                       return next(err); 
                    }
                    else if (!user) {
                        res.json({ success: false, message: 'Activation link has expired.'}); // Token may be valid but does not match any user in the database
                    }
                    else if(user.active){
                       res.json({ success: false, message: 'Account already verified'});  
                    } 
                    else {
                        user.tempToken = false; // Remove temporary token
                        user.active = true; // Change account status to Activated
                        user.save(function(err) {
                            if (err) {
                                return next(err);
                            } 
                            else {
                                const msg = {
                                    to: user.userName,
                                    from: 'dripocare@evelabs.co',
                                    subject: 'Account activated',
                                    text: 'Hello ' + user.userName + ', Your account has been successfully activated!',
                                    html: 'Hello<strong> ' + user.userName + '</strong>,<br><br>Your account has been successfully activated!'
                                };
                                sgMail.send(msg);
                                res.status(201).json({success:true,message:'Account activated'});

                                // auth
                                /*
                                const transporter = nodemailer.createTransport({
                                    service: 'gmail',
                                    auth: {
                                        user: 'dripocare@gmail.com',
                                        pass: gmailPass
                                    }
                                });

                                // email options
                                let mailOptions = {
                                    from: fromMail,
                                    to: user.userName,
                                    subject: 'Account activated',
                                    html: 'Hello<strong> ' + user.userName + '</strong>,<br><br>Your account has been successfully activated!'

                                };

                                // send email
                                transporter.sendMail(mailOptions, (error, response) => {
                                    if (error) {
                                        res.status(201).json({success:false,message:'Try Login'});
                                    }
                                    res.status(201).json({success:true,message:'Account activated'});
                                });
                                */
                            }
                         });
                    }
                });

            }
        });
    

});

//route to verify the user before resending verification link

router.post('/resend', [check('userName')
    .exists().withMessage("userName is required field")
    .not().isEmpty().withMessage("userName field is empty")
    .isEmail().withMessage("userName should be a valid email id"),
    check('password')
    .exists().withMessage("password is required field")
    .not().isEmpty().withMessage("password field is empty")
    .isLength({ min: 5 }).withMessage("password should be min 5 characters")], (req, res ,next) => 
    {    
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        User.findOne({userName:req.body.userName}).select('userName password active').exec(function (err,user) {
        if(err) {
            return next(err);
        }
        if(!user){
            res.json({success:false,message:"No user found"});
        }
        else if(user){
            var validPassword = user.comparePassword(req.body.password);
            if (!validPassword){
                res.json({success:false,message:"Invalid password"});
            }
            else if(user.active){
                res.json({success:false,message:"Account is already active"});
            }
            else{
                res.json({ success: true, user: user });

            }

        }
        
    });
});


// Route to send user a new activation link once credentials have been verified
router.put('/resend', [check('userName')
    .exists().withMessage("userName is required field")
    .not().isEmpty().withMessage("userName field is empty")
    .isEmail().withMessage("userName should be a valid email id")], (req, res ,next) => 
    {    

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        User.findOne({ userName: req.body.userName }).select('userName hospitalName tempToken').exec(function(err, user) {
        if (err) {
            return next(err);

        }
        if(!user){
            res.json({success:false,message:"No user found"});
        }
        else if(user){
            user.tempToken = jwt.sign({userName:user.userName,hospitalName:user.hospitalName},secret,{expiresIn:'24h'});
            // Save user's new token to the database
            user.save(function(err) {
                if (err) {
                    return next(err);
                } else {
                    var host=req.get('host');
                    //link for the mail for activation of account
                    var link="http://"+req.get('host')+"/activate/"+user.tempToken; 
                    var ipaddress = ip.address();
                    var offlinelink = "http://localhost:4200/guest/activate/"+user.tempToken; 
                    var onlinelink = "https://dripo.care/guest/activate/"+user.tempToken; 

                    const msg = {
                        to: user.userName,
                        from: 'dripocare@evelabs.co',
                        subject: 'Verification Link For dripo.care',
                        text: '******Verification link for dripo.care***********',                
                        html: "Hello "+user.userName+",<br> Please Click on the link to verify your email.<br><a href="+onlinelink+">Click here to verify</a>" ,
                    };
                    sgMail.send(msg);
                    res.json({ success: true, message: 'Activation link has been sent to ' + user.userName + '!' }); // Return success message to controller
                     // auth

                    /*
                     const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: 'dripocare@gmail.com',
                            pass: gmailPass
                        }
                    });

                    // email options
                    let mailOptions = {
                        from: fromMail,
                        to: user.userName,
                        subject: 'Verification Link For dripo.care',
                        html: "Hello "+user.userName+",<br> Please Click on the link to verify your email for dripo.care.<br><a href="+onlinelink+">Click here to verify</a><br>Please Click on this link to verify your email if you are registered local server<br><a href="+offlinelink+">Click here to verify</a>" ,

                    };

                    // send email
                    transporter.sendMail(mailOptions, (error, response) => {
                        if (error) {
                            res.status(201).json({success:false,message:'Try Another email id'});
                        }
                        res.status(201).json({success:true,message:'Activation link has been sent to ' + user.userName + '!'});
                    });

                    */
                    
                }
            });

        }
    
    });
});


// Route to send reset link to the user
router.put('/forgotpassword', [check('userName')
    .exists().withMessage("userName is required field")
    .not().isEmpty().withMessage("userName field is empty")
    .isEmail().withMessage("userName should be a valid email id")], (req, res ,next) => 
    {   

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    User.findOne({ userName: req.body.userName }).select('userName active resetToken ').exec(function(err, user) {
        if (err) {
            return next(err);
        } // Throw error if cannot connect
        if (!user) {
            res.json({ success: false, message: 'Username was not found' }); // Return error if username is not found in database
        } else if (!user.active) {
            res.json({ success: false, message: 'Account has not yet been activated' }); // Return error if account is not yet activated
        } else {
            user.resetToken = jwt.sign({userName:user.userName,hospitalName:user.hospitalName},secret,{expiresIn:'24h'}); // Create a token for activating account through e-mail
            // Save token to user in database
            user.save(function(err) {
                if (err) {
                    return next(err);
                } else {
                    var host=req.get('host');
                    //link for the mail for activation of account
                    var link="http://"+req.get('host')+"/resetpassword/"+user.resetToken; 
                    var ipaddress = ip.address();
                    var offlinelink = "http://localhost:4200/guest/resetpassword/"+user.resetToken;
                    var onlinelink = "https://dripo.care/guest/resetpassword/"+user.resetToken;;
                    const msg = {
                        to: user.userName,
                        from: 'dripocare@evelabs.co',
                        subject: 'Verification Link For dripo.care',
                        text: '******Email Contains two type links***********',
                        html:  "Hello "+user.userName+",<br> Please Click on the link to reset your dripo.care account password.<br><a href="+onlinelink+">Click here to reset</a>",
                    };
                    sgMail.send(msg);
                    res.json({ success: true, message: 'Please check your e-mail for password reset link' }); // Return success message
                    
                    /*
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: 'dripocare@gmail.com',
                            pass: gmailPass
                        }
                    });

                    // email options
                    let mailOptions = {
                        from: fromMail,
                        to: user.userName,
                        subject: 'dripo.care password Reset ',
                        html:  "Hello "+user.userName+",<br> Please Click on the link to reset your dripo.care account password.<br><a href="+onlinelink+">Click here to reset</a><br> Please Click on this link to change local account password<br><a href="+offlinelink+">Click here to reset</a>" 

                    };

                    // send email
                    transporter.sendMail(mailOptions, (error, response) => {
                        if (error) {
                            res.status(201).json({success:false,message:'Error sending link'});
                        }
                        res.status(201).json({success:true,message:'Please check your e-mail for password reset link'});
                    });

                    */
                }
            });
        }
    });
});

//route to verify the password reset link

router.get('/resetpassword', [query('token')
    .exists().withMessage("token field is require")
    .not().isEmpty().withMessage("token field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    User.findOne({ resetToken: req.query.token }, function(err, user) {
        if (err) {
            return next(err);
        }

        var token = req.query.token; // Save the token from URL for verification 

        // Function to verify the user's token
        jwt.verify(token, secret, function(err, decoded) {
            if (err) {
                res.json({ success: false, message:'Invalid Link'}); // Token is expired
            } else if (!user) {
                res.json({ success: false, message: 'Password reset link has expired' }); // Token may be valid but does not match any user in the database
            } else {
                res.json({ success: true,message:'You can now reset password',data:user}); // Return success message to controller
            }
        });
    });       
});


router.post('/resetpassword', [check('userName')
    .not().isEmpty().withMessage("userName field is empty")
    .isEmail().withMessage("userName should be a valid email id"),
    check('password')
    .not().isEmpty().withMessage("password field is empty")
    .exists().withMessage("password is required field")
    .isLength({ min: 5 }).withMessage("password should be min 5 characters"),
    check('confirmPassword', 'confirmPassword field must have the same value as the password field')
    .not().isEmpty().withMessage("confirmPassword field is empty")
    .exists().withMessage("confirmPassword field is required")
    .custom((value, { req }) => value === req.body.password)], (req, res ,next) => 
    {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        User.findOne({userName: req.body.userName}).select('userName password resetToken').exec(function(err, user) {
            if (err) {
                return next(err);
            } 
            user.password = req.body.password;
            user.resetToken = false;
            user.save(function(err) {
                if (err) {
                   return next(err); 
                } 
                else {
                const msg = {
                    to: user.userName,
                    from: 'dripocare@evelabs.co',
                    subject: 'Password changed',
                    text: 'You have successfully changed your password',
                    html : "Hello "+user.userName+",<br>You have successfully reset your password <br>" 
                };
                sgMail.send(msg);                   
                res.json({ success: true, message: 'Your password changed successfully'});
                
                /*
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'dripocare@gmail.com',
                        pass: gmailPass
                    }
                });

                // email options
                let mailOptions = {
                    from: fromMail,
                    to: user.userName,
                    subject: 'Password changed',
                    html : "Hello "+user.userName+",<br>You have successfully reset your password <br>" 

                };

                // send email
                transporter.sendMail(mailOptions, (error, response) => {
                    if (error) {
                        res.status(201).json({success:false,message:'Error sending email'});
                    }
                    res.status(201).json({success:true,message:'Your password changed successfully'});
                }); 
                */
            }
        });
    });
});
//route for login
router.post('/login', [check('userName')
    .not().isEmpty().withMessage("userName field is empty")
    .isEmail().withMessage("userName should be a valid email id"),
    check('password')
    .exists().withMessage("password is required field")
    .not().isEmpty().withMessage("password field is empty"),], (req, res ,next) => 
    {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        //finding user from database
        User.findOne({userName:req.body.userName}).select('userName _id hospitalName password active admin permission').exec(function (err,user) {
            if(err) {
                return next(err); 
            }
            //if no user found resond with no user found error message
            if(!user){
                res.status(422).json({success:false,message:"No user found"});
            }
            //if user found checking for password match
            else if(user){
                var validPassword = user.comparePassword(req.body.password);
                if (!validPassword){
                    res.status(422).json({success:false,message:"Wrong password"});
                }
                //if password matches check whether user has an active account
                else if(!user.active){
                    res.status(201).json({success:true,message:"Account is not yet activated",expired:true});
                }
                else{
                    //successful login and passing a token to the user for login
                    var token = jwt.sign({userName:user.userName,hospitalName:user.hospitalName,uid:user._id,admin:user.admin,permission:user.permission},privateKey, { algorithm: 'RS256'});
                    res.json({success:true,message:"Authentication success",token:token,permission:user.permission});

                }
            }    
        });
    
    });

//middleware to get all the details decoded from the token
router.use(function (req,res,next) {
    var tokenPart = req.body.token || req.query.token || req.headers['authorization'];
    if(tokenPart){
        var token = tokenPart.split(' ')[1];
        //verify token
        jwt.verify(token, publicKey, function(err, decoded) {
            if(err){
                res.json({success:false,message:"Invalid Token"});
            }
            else{
                req.decoded=decoded;
                next();
            }
        });
    }
    else{
        res.json({success:false,message:"No token provided"})
    }
});


//function to restrict routes based on user roles
function requireRole (role) {
    return function (req, res, next) {
        if (req.decoded.permission === role) {
            next();
        } else {
            res.send(403);
        }
    }
}

router.all("/admin/*", requireRole("admin"));
router.all("/nurse/*", requireRole("nurse"));

//routes for admin operation******************************************

router.post('/admin/user', [check('userName')
    .exists().withMessage("userName is required field")
    .not().isEmpty().withMessage("userName field is empty")
    .isEmail().withMessage("userName should be a valid email id"),
    check('accountType')
    .exists().withMessage("accountType is required field"),
    check('password')
    .exists().withMessage("password is required field")
    .not().isEmpty().withMessage("password field is empty")
    .isLength({ min: 5 }).withMessage("password should be min 5 characters"),
    check('confirmPassword', 'confirmPassword field must have the same value as the password field')
    .not().isEmpty().withMessage("confirmPassword field is empty")
    .exists().withMessage("confirmPassword field is required")
    .custom((value, { req }) => value === req.body.password)],(req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    var user = new User();
    user.hospitalName = req.decoded.hospitalName;
    user.userName = req.body.userName;
    user.password = req.body.password;
    user.permission = req.body.accountType;
    user.active = true;
    user.admin = req.decoded.userName;
    user.tempToken = false;
    user.save(function(err){
        if (err) {
            return next(err);
        }
        else{

            res.status(201).json({success:true,message:'User created!'});
        }
    });  
        
});

//route for fetching all the user details to the admin view
router.get('/admin/user', function(req,res){
    User.find({admin: req.decoded.userName}).select('userName  permission').exec(function(err, user) { 
            if (err) {
                return next(err);
            }
            if(!user.length){
                res.status(200).json({success:false,message:'Add users and start managing'});
            }
            else{

                res.status(200).json({success:true,message:'User found',data:user});
            }
    });
});


//route for fetching all the user details to the admin view
router.put('/admin/user', [check('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty"),
    check('password')
    .exists().withMessage("password is required field")
    .not().isEmpty().withMessage("password field is empty")
    .isLength({ min: 5 }).withMessage("password should be min 5 characters"),
    check('confirmPassword', 'confirmPassword field must have the same value as the password field')
    .not().isEmpty().withMessage("confirmPassword field is empty")
    .exists().withMessage("confirmPassword field is required")
    .custom((value, { req }) => value === req.body.password)], (req, res ,next) => 
{

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    User.findOne({_id:req.body._id}).select('userName password resetToken').exec(function(err, user) {
        if (err) {
            return next(err);
        }
        if(!user){
            res.status(422).json({success:false,message:'no user found'})
        }
        else{
            user.password = req.body.password;
            user.save(function(err) {
                if (err) {
                    return next(err);
                } 
                else {
                    res.json({ success: true, message: 'Password changed successfully'}); 
                }
            });       

        }
        
    });

});

//route to delete an user from database
router.delete('/admin/user', [query('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }    
    User.findOneAndRemove({_id:req.query._id},function (err,user) {
        if(err){
            return next(err);

        }
        if(!user){
            return res.status(404).json({success: false, message: 'User not found'});
        }
        else{
            res.json({success:true,message:"User removed successfully"});
        }
    });
});


//route to add new station
router.post('/admin/station',[check('stationName')
    .exists().withMessage("stationName field is require")
    .not().isEmpty().withMessage("stationName field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    Station.findOne({stationName: req.body.stationName,admin:req.decoded.userName}).exec(function(err,station) {
        if (err) {
            return next(err);
        }
        if(!station){
                var station = new Station();
                station.stationName = req.body.stationName;
                station.admin = req.decoded.userName;
                station._admin = ObjectId(req.decoded.uid);
                // saving user to database
                station.save(function(err){
                    if (err) {
                        return next(err);
                    }
                    else{

                        res.status(201).json({success:true,message:'Station added'});
                        //socket.data.updateIvsets(req.decoded.userName);

                    }
                });
        }
        else{
            res.status(422).json({success:false,message:'You have already added this station name'})

        }

    });      

});

//route for fetching all the station details to the admin view
router.get('/admin/station', function(req,res){
    Station.find({admin: req.decoded.userName}).exec(function(err, station) {    
            if (err){
                return next(err);
            }
            if(!station.length){
                res.status(200).json({success:false,message:'Add Stations and Start Managing'});
            }
            
            else{

                res.json({success:true,message:'Station found',data:station});
            }
    });
});


router.put('/admin/station',[check('stationName')
    .exists().withMessage("stationName field is require")
    .not().isEmpty().withMessage("stationName field is empty"),
    check('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    Station.findOne({stationName: req.body.stationName,admin:req.decoded.userName}).exec(function(err,station) {
        if (err) {
            return next(err);
        }
        if(!station){
            Station.findOne({_id:req.body._id}).select('stationName').exec(function(err,oldstation) {
                if(err){
                    return next(err);
                }
                else{
                    Bed.updateMany({_station:req.body._id}, { $set: { stationName:req.body.stationName}},function (err) {
                        if(err){
                            return next(err)
                        }
                        else{
                            Dripo.updateMany({_station:req.body._id}, { $set: { stationName:req.body.stationName}},function (err) {
                                if(err){
                                    return next(err)
                                }
                                else{
                                    oldstation.stationName=req.body.stationName;
                                    oldstation.save(function (err) {
                                        if(err) {
                                            return next(err);
                                        }
                                        else{
                                            res.json({success:true,message:'Station name updated',stations:station});
                                        }
                                    });

                                }
                            });

                        }
                    })

                }
             
            });            
        }
        else{
            res.status(422).json({success:false,message:'You have already added this station name'})
        }

    });      

});

//route to delete a station from database
router.delete('/admin/station', [query('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }    
    Station.findOne({_id:req.query._id},function (err,station) {
        if(err){
            return next(err);

        }
        if(!station){
            return res.status(404).json({success: false, message: 'Station not found'});
        }
        else{
            Bed.findOne({_station:req.query._id,status:'occupied'},function (err,bed) {
                if(err){
                    return next(err);
                }
                if(bed){
                    return res.status(422).json({success: false, message: 'Unable to remove station bed '+bed.bedName+' is occupied'});

                }
                else{
                   Dripo.findOne({_station:req.query._id,status:'online'},function (err,dripo) {
                        if(err){
                            return next(err);
                        }
                        if(dripo){
                            return res.status(422).json({success: false, message: 'Unable to remove station dripo '+dripo.dripoId+' is online'});
                        }
                        else{

                            Bed.deleteMany({_station:req.query._id}, function (err) {
                                if(err){
                                   return next(err); 
                                }
                                else{
                                    Dripo.deleteMany({_station:req.query._id}, function (err) {
                                        if(err){
                                            return next(err); 
                                        }
                                        else{
                                            Station.remove({_id: req.query._id}, function (err) {
                                                if(err){
                                                    return next(err);
                                                }
                                                else{
                                                    res.json({success:true,message:"station removed successfully"});
                                                    //socket.data.updateIvsets(req.decoded.userName);

                                                }
                                            });

                                        }

                                    })
  
                                }
                            });

                        }
                   })
 
                }
            })
        }
    });
});


router.post('/admin/bed',[check('stationId')
    .exists().withMessage("stationId field is require")
    .not().isEmpty().withMessage("stationName field is empty"),
    check('bedName').exists().withMessage("bedName field is require")
    .not().isEmpty().withMessage("bedName field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    Station.findOne({_id: req.body.stationId,admin:req.decoded.userName}).exec(function(err,station) {
        if(err){
            return next(err);
        }
        if(!station){
            res.status(404).json({success:false,message:'No station found'});

        }
        else{

            var bedArray = [];
            var beds = req.body.bedName;
            var bedArray = beds.split(",");
            var bedObjArray=[{}];

           for (var key in bedArray){
            var bedObj={};
            bedObj.bedName=bedArray[key];
            bedObj.admin=req.decoded.userName;
            bedObj.stationName=station.stationName;
            bedObj._admin = ObjectId(req.decoded.uid);
            bedObj._station = ObjectId(station._id);
            bedObj.status = 'unoccupied'
            bedObjArray[key] = bedObj;
           }

           Bed.collection.insert(bedObjArray, onInsert);
               function onInsert(err,docs){
                if(err){
                    return next(err);
                } 
                else{
                    res.json({success:true,message:'Bed added successfully'});
              

                }
            }
            
        }
    
    });

});

//route for fetching all the bed details to the admin view
router.get('/admin/bed', function(req,res){
    Bed.find({admin: req.decoded.userName}).sort({'bedname':1}).exec(function(err, bed) {    
            if (err) {
              return next(err);  
            }
            if(!bed.length){
                res.status(200).json({success:false,message:'Add Beds and Start Managing'});
            }
            
            else{
                res.json({success:true,message:'Bed found',data:bed});
            }
    });
});

router.put('/admin/bed',[check('bedName')
    .exists().withMessage("stationName field is require")
    .not().isEmpty().withMessage("stationName field is empty"),
    check('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    Bed.findOne({_id:req.body._id}).exec(function(err,bed) {
        if (err) {
           return next(err);   
        }
        bed.bedName= req.body.bedName;
        bed.save(function(err) {
            if (err) {
                return next(err);   
            } else {
                res.json({ success: true, message: 'Bed name updated'});
                //socket.data.updateBeds(bed._station); 
            }
        });
    });

});

//route to delete a bed from database
router.delete('/admin/bed', [query('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }    
    Bed.findOne({_id:req.query._id},function (err,bed) {
        if(err){
            return next(err);

        }
        if(!bed){
            return res.status(404).json({success: false, message: 'Bed not found'});
        }
        else{
            if(bed.status == 'occupied'){
                return res.status(422).json({success: false, message: 'Unable to remove an occupied bed'});
            }
            Bed.remove({_id: req.query._id }, function (err) {
                if(err){
                    return next(err);
                }
                else{
                    res.json({success:true,message:"Bed removed successfully"});
                    //socket.data.updateBeds(bed._station); 

                }
            });
        }
    });
});
router.post('/admin/ivset',[check('ivsetModel')
    .exists().withMessage("ivsetModel field is require")
    .not().isEmpty().withMessage("ivsetModel field is empty"),
    check('ivsetDpf')
    .exists().withMessage("ivsetDpf field is require")
    .not().isEmpty().withMessage("ivsetDpf field is empty")], (req, res ,next) =>  
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }     

    var ivset = new Ivset();
    ivset.ivsetModel = req.body.ivsetModel;
    ivset.ivsetDpf = req.body.ivsetDpf;
    ivset.admin = req.decoded.userName;
    ivset._user = ObjectId(req.decoded.uid)
    // saving user to database
    ivset.save(function(err){
        if (err) {
            return next(err);
        }
        else{

            res.status(201).json({success:true,message:'Ivset added successfully'});

        }
    });

});

//route for fetching all the ivset details to the admin view
router.get('/admin/ivset', function(req,res){
    Ivset.find({admin: req.decoded.userName}).exec(function(err, ivset) { 
            if(err){
                return next(err);
            }   
            if(!ivset.length){
                res.json({success:false,message:'Add Ivset and Start Managing'});
            }
            
            else{

                res.json({success:true,message:'Ivset found',data:ivset});

            }
    });
});


router.put('/admin/ivset',[check('ivsetModel')
    .exists().withMessage("ivsetModel field is require")
    .not().isEmpty().withMessage("ivsetModel field is empty"),
    check('ivsetDpf')
    .exists().withMessage("ivsetDpf field is require")
    .not().isEmpty().withMessage("ivsetDpf field is empty"),
    check('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) =>  
{

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }     

    Ivset.findOne({_id:req.body._id}).select('ivsetModel ivsetDpf').exec(function(err,ivset) {
        if (err) {
            return next(err);
        }
        else if(!ivset){
            res.status(404).json({success:false,message:'No ivset found'});
        }
        else{

            ivset.ivsetModel= req.body.ivsetModel;
            ivset.ivsetDpf= req.body.ivsetDpf;
            ivset.save(function(err) {
                if (err) {
                    return next(err);
                } else {
                    res.json({ success: true, message: 'Ivset details updated'});
            
                }
            });

        }
        
    });
});


//route to delete a bed from database
router.delete('/admin/ivset', [query('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    Ivset.findOneAndRemove({_id:req.query._id},function (err,ivset) {
        if(err){
            return next(err);

        }
        if(!ivset){
            return res.status(404).json({success: false, message: 'Ivset not found'});
        }
        else{
            //remove all beds and dripos linked to station
            res.json({success:true,message:"Ivset removed successfully"});
        }
    });    
   
});

//add dripo route
router.post('/admin/dripo',[check('stationId')
    .exists().withMessage("stationId field is require")
    .not().isEmpty().withMessage("stationName field is empty"),
    check('dripoId').exists().withMessage("dripoId field is require")
    .not().isEmpty().withMessage("dripoId field is empty"),
    check('altName').exists().withMessage("altName field is require")
    .not().isEmpty().withMessage("altName field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    Station.findOne({_id: req.body.stationId,admin:req.decoded.userName}).exec(function(err,station) {
        if(err){
            return next(err);
        }
        if(!station){
            res.status(404).json({success:false,message:'No station found'});

        }
        else{
        Dripo.findOne({dripoId:req.body.dripoId}).exec(function (err,dripo1) {
            if(err){
                return next(err);
            }
            if(dripo1){
               res.json({success:false,message:'Dripo already exist'});  
            }
            else{

                Dripo.find({altName:req.body.altName,_station:req.body.stationId}).exec(function (err,dripo2) {
                    if(err){
                        return next(err);
                    }
                    if(dripo2.length !=0){
                       res.json({success:false,message:'ALternative name already taken'}); 
                    }
                    else{
                        var newDripo = new Dripo();
                        newDripo.dripoId = req.body.dripoId;
                        newDripo.altName = req.body.altName;
                        newDripo.stationName = station.stationName;
                        newDripo.admin = req.decoded.userName;
                        newDripo._admin = ObjectId(req.decoded.uid);
                        newDripo._station = ObjectId(station._id);
                        newDripo.status = 'offline';
                        // saving user to database
                        newDripo.save(function(err){
                            if (err) {
                                return next(err);
                            }
                            else{
                                res.status(201).json({success:true,message:'Dripo added successfully'});

                            }
                        });
                       
                    }
                });

            }
        })
            
        }
    
    });


});

//route for fetching all the dripo details to the admin view
router.get('/admin/dripo', function(req,res){
    Dripo.find({admin: req.decoded.userName}).exec(function(err, dripo) {    
            if (err) {
                return next(err);
            }
            if(!dripo.length){
                res.json({success:false,message:'Add Dripo and Start Managing'});
            }
            
            else{

                res.json({success:true,message:'Dripo found',data:dripo});
            }
    });
});

router.put('/admin/dripo',[check('stationId')
    .exists().withMessage("stationId field is require")
    .not().isEmpty().withMessage("stationName field is empty"),
    check('dripoId').exists().withMessage("dripoId field is require")
    .not().isEmpty().withMessage("dripoId field is empty"),
    check('altName').exists().withMessage("altName field is require")
    .not().isEmpty().withMessage("altName field is empty"),
    check('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    Station.findOne({_id: req.body.stationId,admin:req.decoded.userName}).exec(function(err,station) {
        if(err){
            return next(err);
        }
        if(!station){
            res.status(404).json({success:false,message:'No station found'});

        }
        else{
           Dripo.findOne({_id:req.body._id,admin:req.decoded.userName}).exec(function (err,dripo) {
               if(err){
                return next(err);
               }
               else if(!dripo){
                    res.status(404).json({success:false,message:'No dripo found'});
               }
               else if(dripo.status == 'ongoing' || dripo.status == 'alerted' ){
                    res.status(422).json({success:false,message:'Unable to edit online device'});
               }
               else{
                    dripo.stationName=station.stationName;
                    dripo._station = station._id;
                    dripo.dripoId = req.body.dripoId;
                    dripo.altName = req.body.altName;
                    dripo.save(function (err) {
                        if(err){
                            return next(err);
                        }
                        else{
                            res.json({success:true,message:'Dripo details updated'});
                        }
                    });
               }
           })
            
            
        }
    
    });

});

router.delete('/admin/dripo', [query('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    Dripo.findOne({_id:req.query._id},function (err,dripo) {
        if(err){
            return next(err);

        }
        else if(!dripo){
            return res.status(404).json({success: false, message: 'Ivset not found'});
        }
        else if(dripo.status == 'online'){
            res.status(422).json({success:false,message:'Unable to delete online device'});
        }

        else{
           Dripo.remove({_id: req.query._id}, function (err) {
               if(err){
                   return next(err);
               }
               else{
                   res.json({success:true,message:"Dripo removed successfully"});

               }
           });
        }
    });    
   
});


//routes for nurses starts here*********************************************************

router.get('/nurse/station', function(req,res){
    if(req.decoded.admin){
        Station.find({admin: req.decoded.admin}).exec(function(err, station) {    
                if (err){
                    return next(err);
                }
                if(!station.length){
                    res.status(200).json({success:false,message:'Contact admin to add station'});
                }
                
                else{

                    res.json({success:true,message:'Station found',data:station});
                }
        });
    }
    else{
        res.status(422).json({success:false,message:'Decoded token has no admin value'});
    }
    
});



//route to set new token including the user selected station
router.post('/nurse/setstation',[check('stationId')
    .exists().withMessage("stationId field is require")
    .not().isEmpty().withMessage("stationId field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }


    Station.findOne({_id:req.body.stationId}).exec(function(err, station) {
        if(err){
           return next(err); 
        }
            if(station.length == 0){
                res.json({success:false,message:"Selected Station not found"});
            }
            else{
                var token = jwt.sign({userName:req.decoded.userName,hospitalName:req.decoded.hospitalName,uid:req.decoded.uid,admin:req.decoded.admin,permission:req.decoded.permission,stationName:station.stationName,stationId:station._id},privateKey, { algorithm: 'RS256'});
                res.json({success:true,message:"token updated",token:token});

            }

        }); 
   
            
});


router.get('/nurse/bed', function(req,res){
    if(req.decoded.admin && req.decoded.stationId){
        Bed.find({admin: req.decoded.admin,status:'unoccupied',_station:req.decoded.stationId}).exec(function(err, bed) {    
                if (err){
                    return next(err);
                }
                if(!bed.length){
                    res.status(200).json({success:false,message:'Contact admin to add bed'});
                }
                
                else{

                    res.json({success:true,message:'bed found',data:bed});
                }
        });
    }
    else{
        res.status(422).json({success:false,message:'Decoded token has no admin or stationId value'});
    }
    
});


router.get('/nurse/doctor', function(req,res){
    User.find({admin: req.decoded.admin,permission:'doctor'}).exec(function(err, user) {    
            if (err){
                return next(err);
            }
            if(!user.length){
                res.status(200).json({success:false,message:'Contact admin to add doctor user'});
            }
            
            else{

                res.json({success:true,message:'doctor found',data:user});

            }
    });
});

router.post('/nurse/patient',[check('patientName')
    .exists().withMessage("patientName field is require")
    .not().isEmpty().withMessage("patientName field is empty"),
    check('bedId').exists().withMessage("bedId field is require")
    .not().isEmpty().withMessage("bedId field is empty"),
    check('patientGender')
    .exists().withMessage("patientGender field is require")
    .not().isEmpty().withMessage("patientGender field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    var patient = new Patient();
    patient.patientName= req.body.patientName;
    patient.patientAge= req.body.patientAge;
    patient.patientWeight= req.body.patientWeight;
    patient.patientGender= req.body.patientGender;
    patient.patientStatus= "active";
    patient.doctor = req.body.doctor;
    patient.admittedOn = new Date();
    patient.admin = req.decoded.admin;
    patient._station = ObjectId(req.decoded.stationId);
    // saving user to database
    patient.save(function(err,patient){
        if (err) {
            return next(err);
        }
        else{
            Bed.findOne({_id:ObjectId(req.body.bedId)}).exec(function(err, bed) {
                if (err) {
                    return next(err);
                }
                if(!bed){
                    res.json({success:false,message:'Invalid Bed'});
                }
                else{
                    bed.status = 'occupied';
                    bed._patient = patient._id;
                    bed.save(function (err) {
                        if(err) {
                            return next(err);
                        }
                        else{
                            Patient.collection.update({_id:patient._id},{$set:{_bed:bed._id,bedName:bed.bedName}},{upsert:false});
                            res.json({success:true,message:'Patient added and bed status updated'});
                        }
                    });

                }
            

            });
        }
    });

});

//route for fetching all the patient details to nurse 
router.get('/nurse/patient', function(req,res){
    if(req.decoded.admin && req.decoded.stationId){
        Patient.find({_station:ObjectId(req.decoded.stationId)}).exec(function(err,patient) {   
            if (err) {
                return next(err);
            }
            if(!patient.length){
                res.json({success:false,message:'No patient found'});
            }
            else{
                res.json({success:true,message:'Patients found',data:patient});
            }
        });
    }
    else{
        res.json({success:false,message:'Decoded token has no station value'});

    }
    
});


router.put('/nurse/patient',[check('patientName')
    .exists().withMessage("patientName field is require")
    .not().isEmpty().withMessage("patientName field is empty"),
    check('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty"),
    check('bedId').exists().withMessage("bedId field is require")
    .not().isEmpty().withMessage("bedId field is empty"),
    check('patientGender')
    .exists().withMessage("patientGender field is require")
    .not().isEmpty().withMessage("patientGender field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    Patient.findOne({_id: req.body._id}).exec(function(err,patient) {
        if(err){
           return next(err); 
        }
        if(!patient){
            res.json({success:false,message:'No patient found'});
        }
        else{
            patient.patientName= req.body.patientName;
            patient.patientAge= req.body.patientAge;
            patient.patientWeight= req.body.patientWeight;
            patient.patientGender= req.body.patientGender;
            patient.patientStatus= "active";
            patient.doctor = req.body.doctor;
            patient.save(function(err) {
                if(err){
                  return next(err);   
                }
                else if(patient._bed != req.body.bedId){
                    Bed.findOne({_id: req.body.bedId}).exec(function(err, bed) {
                        if(err){
                           return next(err);  
                        }
                        if(!bed){
                            res.json({success:false,message:'Invalid Bed'})
                        }
                        else{
                            bed.status = 'occupied';
                            bed._patient = patient._id;
                            bed.save(function (err) {
                                if(err){
                                   return next(err);   
                                }
                                else{
                                    Bed.findOne({_id:patient._bed}).exec(function(err, oldbed) {
                                        if (err){
                                           return next(err);    
                                        }
                                        if(!oldbed){
                                            res.json({success:false,message:'Invalid OldBed'})
                                        }
                                        else{
                                            oldbed.status='unoccupied';
                                            oldbed._patient = null;
                                            oldbed.save(function (err) {
                                                if(err) {
                                                   return next(err);     
                                                }
                                                else{
                                                    Patient.collection.update({_id:patient._id},{$set:{_bed:bed._id,bedName:bed.bedName}},{upsert:false});
                                                    // Task.collection.updateMany({_bed:ObjectId(oldbed._id)},{$set:{_bed:bed._id}},{upsert:false});
                                                    // Medication.collection.updateMany({_bed:ObjectId(oldbed._id)},{$set:{_bed:bed._id}},{upsert:false});
                                                    res.json({success:true,message:'Patient details updated'});

                                                }
                                            });

                                        }
                                        
                                    
                                    });
                                }
                            });
                        }
                    });

                }
                else{
                    res.json({success:true,message:'Patient details updated'})

                }
            })


        }
    });
});

router.delete('/nurse/patient', [query('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    var date = new Date();
    Patient.findOne({_id:req.query._id}).exec(function (err,patient) {
        if(err){
            return next(err);     
        }
        if(!patient){
            res.json({success:false,message:'No patient found'});
        }
        else{
            patient.patientStatus= "discharged";
            patient.dischargedOn= new Date();
            patient.bedName= null;
            patient._bed= null;
            patient.save(function(err) {
                if(err){
                  return next(err);   
                }
                else{
                    Bed.findOne({_patient:patient._id}).exec(function (err,bed) {
                        if(err){
                            return next(err);
                        }
                        if(!bed){
                            res.json({success:false,message:'No bed found'});
                        }
                        else{
                            bed.status = "unoccupied";
                            bed._patient = null;
                            bed.save(function(err) {
                                if(err){
                                  return next(err);   
                                }
                                else{
                                    //Task.collection.remove({_patient:ObjectId(req.body._id)});
                                    //Medication.collection.updateMany({_patient:ObjectId(req.body._id)},{$set:{_bed:""}});
                                    res.json({success:true,message:'Patient discharged'});
                                }
                            });
                        }
                    })
                }
            })

        }
    })

});
            

router.get('/nurse/occupiedbed', function(req,res){
    if(req.decoded.admin && req.decoded.stationId){
        Bed.find({admin: req.decoded.admin,status:'occupied',_station:req.decoded.stationId}).exec(function(err, bed) {    
                if (err){
                    return next(err);
                }
                if(!bed.length){
                    res.status(200).json({success:false,message:'Contact admin to add bed'});
                }
                
                else{

                    res.json({success:true,message:'bed found',data:bed});
                }
        });
    }
    else{
        res.status(422).json({success:false,message:'Decoded token has no admin or stationId value'});
    }
    
});


router.post('/nurse/task',[check('time')
    .exists().withMessage("time field is require")
    .not().isEmpty().withMessage("time field is empty"),
    check('bedId').exists().withMessage("bedId field is require")
    .not().isEmpty().withMessage("bedId field is empty"),
    check('medicineName')
    .exists().withMessage("medicineName field is require")
    .not().isEmpty().withMessage("medicineName field is empty"),
    check('medicineVolume')
    .exists().withMessage("medicineVolume field is require")
    .not().isEmpty().withMessage("medicineVolume field is empty"),
    check('medicineRate')
    .exists().withMessage("medicineRate field is require")
    .not().isEmpty().withMessage("medicineRate field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    var timeIn12;
    var timein24 = Number(req.body.time);
    if(timein24 < 12){
        timeIn12 = timein24.toString() + ' AM'
    }
    else{
        var timeIn12 = (timein24 -12).toString() + ' PM';
    }
    Bed.findOne({_id:req.body.bedId}).exec(function(err,bed) {
        if(err){
            return next(err);
        }
        if(!bed){
            res.status(200).json({success:false,message:'Invalid bedId'});
        }
        else{
            var med = {};
            med.medicineName = req.body.medicineName;
            med.medicineRate = Number(req.body.medicineRate);
            med.medicineVolume = Number(req.body.medicineVolume);
            med._station = ObjectId(req.decoded.stationId);
            med.admin = req.decoded.admin;
            med._bed = ObjectId(req.body.bedId);
            med._patient = ObjectId(bed._patient);
            patientId = ObjectId(bed._patient);
            bedId = ObjectId(req.body.bedId);
            Medication.collection.insert(med, onInsert);
            function onInsert(err,docs){
                if(err){
                   return next(err); 
                }
                else{
                    var timeObj={};
                    //update patient collection and insert thr refernce of medicine id
                    Patient.collection.update({_id:patientId},{$push:{_medication:med._id}},{upsert:false});
                    //docs.ops has the data available and req.body.medications[].time has all the time associated with that medicine
                    docs.ops.forEach(function callback(currentValue, index, array) {
                             timeObj.time=Number(req.body.time);
                             timeObj.timeIn12=timeIn12;
                             timeObj.type='infusion';
                             timeObj.priority = 0;
                             timeObj.status='upcoming';
                             timeObj.totalVolume=Number(req.body.medicineVolume);
                             timeObj.createdAt=new Date();
                             timeObj.infusedVolume =0;
                             timeObj.source="manual";
                             timeObj._patient=patientId;
                             timeObj._bed=bedId;
                             timeObj._medication=currentValue._id;
                             timeObj._station=ObjectId(req.decoded.stationId);
                                                
                    });
                    Task.collection.insert(timeObj, onInsert);
                    function onInsert(err,times) {
                        if(err){
                           return next(err);  
                        }
                        else{
            
                             Medication.collection.update({_id:med._id},{$set:{_task:timeObj._id}},{upsert:false});
                             res.json({success:true,message:"task added successfully"})

                        }
                    }

                }//end of adding medication success
            }//end of medication insert function

        }
    })

});

router.get('/nurse/upcomingtask', function(req,res){
    Task.find({_station:ObjectId(req.decoded.stationId),status:'upcoming'}).sort({time:1}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).populate({path:'_patient',model:'Patient'}).exec(function(err,task) {
        if(err){
            return next(err);
        }
        if(task.length ==0){
            res.status(200).json({success:false,message:'No upcoming task'});
        }
        else{
            res.json({success:true,message:'Upcoming tasks found',data:task});
        }
    })

});

router.get('/nurse/delayedtask', function(req,res){
    Task.find({_station:ObjectId(req.decoded.stationId),status:'delayed'}).sort({time:1}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).populate({path:'_patient',model:'Patient'}).exec(function(err,task) {
        if(err){
            return next(err);
        }
        if(task.length ==0){
            res.status(200).json({success:false,message:'No delayed task'});
        }
        else{
            res.json({success:true,message:'Delayed tasks found',data:task});
        }
    })

});

router.get('/nurse/activetask', function(req,res){
   Task.find({_station:ObjectId(req.decoded.stationId),status:'alerted'}).sort({createdAt:1,time:1}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).populate({path:'_patient',model:'Patient'}).exec(function(err,alertedTask) {
       if(err){
           return next(err);
       }
       if(alertedTask.length ==0){
            Task.find({_station:ObjectId(req.decoded.stationId),status:'ongoing'}).sort({createdAt:1,time:1}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).populate({path:'_patient',model:'Patient'}).exec(function(err,ongoingTask) {
                if(err){
                   return next(err); 
                }
                if(ongoingTask.length == 0){
                    res.json({success:false,message:'No active tasks found'});
                }
                else{
                    res.json({success:true,message:'Active tasks found',data:ongoingTask});
                }

            })
       }
       else{
            Task.find({_station:ObjectId(req.decoded.stationId),status:'ongoing'}).sort({createdAt:1,time:1}).populate({path:'_bed',model:'Bed'}).populate({path:'_medication',model:'Medication'}).populate({path:'_patient',model:'Patient'}).exec(function(err,ongoingTask) {
                if(err){
                   return next(err); 
                }
                if(ongoingTask.length == 0){
                    res.json({success:true,message:'Active tasks found',data:alertedTask});
                }
                else{
                    var task = alertedTask.concat(ongoingTask);
                    res.json({success:true,message:'Active tasks found',data:task});
                }
            })

       }
   })
});

router.delete('/nurse/task', [query('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    Task.findOne({_id:req.query._id},function (err,task) {
        if(err){
            return next(err);

        }
        else if(!task){
            return res.status(200).json({success: false, message: 'Task not found'});
        }
        else{
           Task.remove({_id: req.query._id}, function (err) {
               if(err){
                   return next(err);
               }
               else{
                   res.json({success:true,message:"Task removed successfully"});

               }
           });
        }
    });    
   
});

router.get('/nurse/infusiondetails', [query('_id')
    .exists().withMessage("infusionhistory _id field is require")
    .not().isEmpty().withMessage("infusionhistory _id field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    Infusionhistory.findById({_id:req.query._id}).exec(function (err,inf) {
        if(err){
            return next(err);
        }
        else if(!inf){
            return res.status(200).json({success: false, message: 'No history details available'});
        }
        else{
            res.json({success:true,message:"Details retrieved successfully",data:inf});
        }
    })
});

router.get('/nurse/patienthistory',function (req,res) {
    var dateObj = new Date();
    var month = dateObj.getUTCMonth() + 1; //months from 1-12
    var day = dateObj.getUTCDate();
    var year = dateObj.getUTCFullYear();
    var newDate = day + "/" + month + "/" + year;
    Infusionhistory.find({_station:req.decoded.stationId,date:newDate}).sort({infusionDate:-1}).exec(function (err,inf) {
        if(err){
           return next(err);
        }
        if(inf.length ==0){
            return res.status(200).json({success: false, message: 'No infusions today'});

        }
        else{
           res.json({success:true,message:"History retrieved successfully",data:inf});

        }
    })
})


router.get('/nurse/dripo', function(req,res){
    Dripo.find({_station:ObjectId(req.decoded.stationId)}).sort({altName:1}).exec(function(err,dripo) {
        if(err){
            return next(err);
        }
        if(dripo.length == 0){
            res.json({success:false,message:'No dripo device found'});

        }
        else{
            res.json({success:true,message:'dripos found',data:dripo});

        }
    })


});


router.get('/nurse/infusionhistory', [query('date')
    .exists().withMessage("date field is require")
    .not().isEmpty().withMessage("date field is empty")], (req, res ,next) => 
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    var dateObj=new Date(req.query.date)
    var month = dateObj.getUTCMonth() + 1; //months from 1-12
    var day = dateObj.getUTCDate();
    var year = dateObj.getUTCFullYear();
    var newDate = day + "/" + month + "/" + year;
    console.log(newDate);


    Infusionhistory.find({_station:req.decoded.stationId,date:newDate}).sort({infusionDate:-1}).exec(function (err,inf) {
        if(err){
            return next(err);
        }
        else if(inf.length==0){
            return res.status(200).json({success: false, message: 'No infusions details found for '+newDate});
        }
        else{
            res.json({success:true,message:"Details retrieved successfully",data:inf});
        }
    })
});


router.put('/nurse/blockack',[check('_id')
    .exists().withMessage("_id field is require")
    .not().isEmpty().withMessage("_id field is empty")], (req, res ,next) => 

{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    Dripo.findOne({_id:ObjectId(req.body._id)}).exec(function(err,dripo) {
        if(err){
            return next(err);
        }
        if(dripo.length == 0){
            res.json({success:false,message:'No dripo device found'});

        }
        else{
            var date = new Date();
            var hours = date.getHours();
            var minutes = date.getMinutes()
            dripo.status = 'ongoing';
            dripo.lastMessageMin = minutes;
            dripo.save(function(err) {
                if(err){
                  return next(err);   
                }
                else{
                    res.json({success:true,data:dripo});
                }
            });

        }
    })



});



module.exports=router;