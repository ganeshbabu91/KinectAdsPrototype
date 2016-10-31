var Kinect2 = require('../../lib/kinect2'), //change to 'kinect2' in a project of your own
	express = require('express'),
	app = express(),
	http = require('http'),
	https = require('https'),
	server = http.createServer(app),
	io = require('socket.io').listen(server),
	zlib = require('zlib'),
	fs = require('fs'),
	multiparty = require('multiparty'),
	azureStorage = require('azure-storage'),
	request = require('request');



var kinect = new Kinect2();


if(kinect.open()) {
	server.listen(8000);
	console.log('Server listening on port 8000');
	console.log('Point your browser to http://localhost:8000');

	app.get('/', function(req, res) {
		res.sendFile(__dirname + '/public/index.html');
	});

	app.post('/upload', function(req, res){
		console.log('upload called ');
		var blobService = azureStorage.createBlobService();
	    var form = new multiparty.Form();

	    form.on('part', function(part) {
	      if (!part.filename) return;

	      var size = part.byteCount;
	      var name = part.filename;
	      var container = 'hacktx2016';

	      console.log("creating blobService");
	      	blobService.createBlockBlobFromStream(container, name, part, size, function(error) {
	        var url = 'http://kinectads.azurewebsites.net/analyze?url=https://hacktx2016.blob.core.windows.net/hacktx2016/filename.png';
	        http.get(url, function(res) {
	        	console.log("response from server");
			});
			//console.log("wait emitted");
	        //io.sockets.emit('wait', 'true');
			if (error) {
	          console.log('error = ',error);
	        }
	      	});
	      	
	      
    });

    form.parse(req);

    res.send('File uploaded successfully');
	});

	app.use(express.static(__dirname + '/public'));

	// compression is used as a factor to resize the image
	// the higher this number, the smaller the image
	// make sure that the width and height (1920 x 1080) are dividable by this number
	// also make sure the canvas size in the html matches the resized size
	var compression = 3;

	var origWidth = 1920;
	var origHeight = 1080;
	var origLength = 4 * origWidth * origHeight;
	var compressedWidth = origWidth / compression;
	var compressedHeight = origHeight / compression;
	var resizedLength = 4 * compressedWidth * compressedHeight;
	//we will send a smaller image (1 / 10th size) over the network
	var resizedBuffer = new Buffer(resizedLength);
	var compressing = false;
	kinect.on('colorFrame', function(data){
		//compress the depth data using zlib
		if(!compressing) {
			compressing = true;
			
			//data is HD bitmap image, which is a bit too heavy to handle in our browser
			//only send every x pixels over to the browser
			var y2 = 0;
			for(var y = 0; y < origHeight; y+=compression) {
				y2++;
				var x2 = 0;
				for(var x = 0; x < origWidth; x+=compression) {
					var i = 4 * (y * origWidth + x);
					var j = 4 * (y2 * compressedWidth + x2);
					resizedBuffer[j] = data[i];
					resizedBuffer[j+1] = data[i+1];
					resizedBuffer[j+2] = data[i+2];
					resizedBuffer[j+3] = data[i+3];
					x2++;
				}
			}

			zlib.deflate(resizedBuffer, function(err, result){
				if(!err) {
					var buffer = result.toString('base64');

					io.sockets.sockets.forEach(function(socket){
						socket.volatile.emit('colorFrame', buffer);
					});
				}
				compressing = false;
			});
		}
	});

	kinect.openColorReader();

	/*dcompressing = false;

	kinect.on('depthFrame', function(data){
		//compress the depth data using zlib
		if(!dcompressing) {
			dcompressing = true;
			zlib.deflate(data, function(err, result){
				if(!err) {
					var buffer = result.toString('base64');
					io.sockets.sockets.forEach(function(socket){
						socket.volatile.emit('depthFrame', buffer);
					});
				}
				dcompressing = false;
			});
		}
	});

	kinect.openDepthReader();
	
	var ircompressing = false;
	kinect.on('infraredFrame', function(data){
		//console.log("infrared = ",data);
		//compress the infrared data using zlib
		if(!ircompressing) {
			ircompressing = true;
			zlib.deflate(data, function(err, result){
				if(!err) {
					var buffer = result.toString('base64');
					io.sockets.sockets.forEach(function(socket){
						socket.volatile.emit('infraredFrame', buffer);
					});
				}
				ircompressing = false;
			});
		}
	});

	kinect.openInfraredReader();*/

	kinect.on('bodyFrame', function(bodyFrame){

		io.sockets.emit('bodyFrame', bodyFrame);

	});

	kinect.openBodyReader();

    //close the kinect after 5 seconds
    /*setTimeout(function(){
        kinect.close();
        console.log("Kinect Closed");
    }, 5000);*/

    io.on('closeKinect', function(){
    	console.log("closing kinect");
    	kinect.close();
    });

}
