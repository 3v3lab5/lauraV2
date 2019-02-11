var request = require('supertest'),
	 app = require('../server');
const mongoose = require('mongoose');
var chai = require('chai');  
const assert = chai.assert;
const should = chai.should;


before(function (done) {
   mongoose.connect('mongodb://localhost/testDatabase');
   const db = mongoose.connection;
   db.on('error', console.error.bind(console, 'connection error'));
   db.once('open', function() {
     console.log('We are connected to test database!');
     done();
   });
 });


describe("Register",function () {
	it("Registering a user with valid fields",function (done) {
		request(app).post('/api/register')
		.send({userName:"dripocare@gmail.com",hospitalName:"Test",password:"password",confirmPassword:"password"})
		.expect("Content-type",/json/)
		.expect(200,done)
	})
});

describe("Register",function () {
	it("Registering a user with username which is not an email id",function (done) {
		request(app).post('/api/register')
		.send({userName:"test@test",hospitalName:"Test",password:"password",confirmPassword:"password"})
		.expect("Content-type",/json/)
		.expect(422,done)
	})
});

describe("Activate account",function () {
	it("calling a route without providing token",function (done) {
		request(app).put('/api/activate')
		.expect(404,done)
	})
});

describe("Activate account",function () {
	it("calling a route without providing token",function (done) {
		request(app).put('/api/activate/abcd')
		.expect("Content-type",/json/)
		.expect(422,done)
	})
});

describe("Checking user details for sending activation link-- inorder to avoid spamming",function () {
	it("Giving correct credentials for resend activation link",function (done) {
		request(app).post('/api/resend')
		.send({userName:"dripocare@gmail.com",password:"password"})
		.expect("Content-type",/json/)
		.expect(200,done)
	})
	it("calling a route with wrong req.body",function (done) {
		request(app).post('/api/resend')
		.send({username:"dripocare@gmail.com",pass:"password"})
		.expect("Content-type",/json/)
		.expect(422,done)
	})

});

describe("Resend activation link",function () {
	it("calling resend api with userName",function (done) {
		request(app).put('/api/resend')
		.send({userName:"dripocare@gmail.com"})
		.expect("Content-type",/json/)
		.expect(200,done)
	})
	it("calling route without any req.body",function (done) {
		request(app).put('/api/resend')
		.expect("Content-type",/json/)
		.expect(422,done)
	})
	it("calling route without wrong req.body",function (done) {
		request(app).put('/api/resend')
		.send({username:"dripocare@gmail.com"})
		.expect("Content-type",/json/)
		.expect(422,done)
	})
});


describe("Send Password reset link",function () {
	it("calling route with correct req.body",function (done) {
		request(app).put('/api/forgotpassword')
		.send({userName:"dripocare@gmail.com"})
		.expect("Content-type",/json/)
		.expect(200,done)
	})

	it("calling route with incorrect req.body",function (done) {
		request(app).put('/api/forgotpassword')
		.send({username:"dripocare@gmail.com"})
		.expect("Content-type",/json/)
		.expect(422,done)
	})

	it("calling route with ino data req.body",function (done) {
		request(app).put('/api/forgotpassword')
		.expect("Content-type",/json/)
		.expect(422,done)
	})
});

describe("Link for reset password",function () {
	it("calling a route without providing token",function (done) {
		request(app).get('/api/resetpassword')
		.expect(404,done)
	})
	it("calling a route by providing dummy token",function (done) {
		request(app).get('/api/resetpassword/abvsgvd')
		.expect("Content-type",/json/)
		.expect(200,done)
	})

});

describe("Enter new password and save",function () {
	it("calling a route with correct req.body",function (done) {
		request(app).post('/api/savepassword')
		.send({userName:"dripocare@gmail.com",password:"aliceandbob",confirmPassword:"aliceandbob"})
		.expect(200,done)
	})
	it("calling a route by providing dummy token",function (done) {
		request(app).post('/api/savepassword')
		.expect("Content-type",/json/)
		.expect(422,done)
	})

});

describe("Login",function () {
	it("calling a route with correct req.body",function (done) {
		request(app).post('/api/login')
		.send({userName:"dripocare@gmail.com",password:"aliceandbob"})
		.expect(200,done)
	})
	it("calling a route by providing dummy token",function (done) {
		request(app).post('/api/login')
		.expect("Content-type",/json/)
		.expect(422,done)
	})

});

after(function(done){
   mongoose.connection.db.dropDatabase(function(){
     mongoose.connection.close(done);
   });
 });