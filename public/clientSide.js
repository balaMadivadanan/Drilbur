
var client = {};

client.fayeClient;
client.canvas;
client.c;
client.width;
client.height;
client.frame;
client.controller;
client.takingOff = 0;//to detect that the user really wants to land or take off
client.landing = 0;

client.configFaye = function() {
	this.fayeClient = new Faye.Client('/faye',{
		timeout : 120
	});
	
};

client.configLeap = function() {
	this.canvas = document.getElementById( 'canv' );
	this.c = this.canvas.getContext( '2d' );
	this.width = this.canvas.width;
	this.height = this.canvas.height;
	this.controller = new Leap.Controller({ enableGestures: true });
};

client.leapToScene = function( leapPos ) {
	var iBox = this.frame.interactionBox;

	var left = iBox.center[0] - iBox.size[0]/2;
	var top = iBox.center[1] + iBox.size[1]/2;

	var x = leapPos[0] - left;
	var y = leapPos[1] - top;

	x /= iBox.size[0];
	y /= iBox.size[1];

	x *= this.width;
	y *= this.height;

	return [ x , -y ];
};

client.onCircle = function( gesture ) {

	var pos = this.leapToScene( gesture.center );
	var r = gesture.radius;
	
	var clockwise = false;

 	if( gesture.normal[2]  <= 0 ){
    	clockwise = true;
  	}

	// Setting up the style for the stroke, and fill
	this.c.fillStyle   = "#39AECF";
	this.c.strokeStyle = "#FF5A40";
	this.c.lineWidth   = 5;

	// Creating the path for the finger circle
	this.c.beginPath();

	// Draw a full circle of radius 6 at the finger position
	this.c.arc(pos[0], pos[1], r, 0, Math.PI*2); 

	this.c.closePath();

	if( clockwise ){
		this.c.stroke();
		
		if( this.takingOff >= 3 ){
			console.log("takeoff");
			this.takingOff = 0;
			
			var action = {};
			action.action = "takeoff";
			var channel = "/UpDown";	
					
			return this.postOnFaye( action, channel );
		}else{
			this.takingOff++;
			return;
		}
	
	}else{
		this.c.fill();

		if( this.landing >= 3 ){
			console.log("land");
			this.landing = 0;

			var action = {};
			action.action = "land";
			var channel = "/UpDown";
			return this.postOnFaye( action, channel );
		}
		else{
			this.landing++;
			return;
		}
	}

};

client.postOnFaye = function( action, channel ) {	
	return this.fayeClient.publish( channel+'' , action );
};


client.onSwipe = function ( gesture ){

	var startPos = this.leapToScene( gesture.startPosition );

	var pos = this.leapToScene( gesture.position );

	// Setting up the style for the stroke
	this.c.strokeStyle = "#FFA040";
	this.c.lineWidth = 3;

	// Drawing the path
	this.c.beginPath();

	// Move to the start position
	this.c.moveTo( startPos[0] , startPos[1] );

	// Draw a line to current position
	this.c.lineTo( pos[0] , pos[1] );

	this.c.closePath();
	this.c.stroke();
};

client.getFrame = function() {

	var _this = this;
	this.controller.on( 'frame' , function( data ){
  
		_this.frame = data;

		_this.c.clearRect( 0 , 0 , _this.width , _this.height );

		for( var i =  0; i < _this.frame.gestures.length; i++ ){
			
			var gesture  = _this.frame.gestures[i];
			var type = gesture.type;
	          
			switch( type ){

				case "circle":
					_this.onCircle( gesture );
					break;
				  
				case "swipe":
					_this.onSwipe( gesture );
					break;
	  		}
	  	}

  		if( _this.frame.hands.length >= 1 ){
  			var firstHand = _this.frame.hands[0];
  			var shakingMvt = 0.30;

  			if( firstHand.palmNormal[0] > shakingMvt ){
  				//going left
  				_this.flyThisWay( 'left', firstHand.palmNormal[0]+shakingMvt );
  				//add the shaking thing so we have a speed between 0 and 1 
  				//because the drone api take a speed in this range.
  				
  			}else if( firstHand.palmNormal[0] < -shakingMvt ){
  				//going right
  				_this.flyThisWay( 'right', firstHand.palmNormal[0]+shakingMvt );
  				
  			}

  			if( firstHand.palmNormal[2] > shakingMvt ){
  			 	//going forward
  				_this.flyThisWay( 'front', firstHand.palmNormal[2]+shakingMvt );
  				
	        }else if( firstHand.palmNormal[2] < -shakingMvt ){
	        	//going backward
  				_this.flyThisWay( 'back', firstHand.palmNormal[2]+shakingMvt );
  			}	    
		}
	});
};

client.flyThisWay = function(direction,speed) {

	var action = {};
	action.speed = speed;
	action.action = direction;
	if( direction.indexOf( 'right' ) > -1 || direction.indexOf( 'left' ) > -1  )
		var channel =  '/LeftRight';
	else if ( direction.indexOf( 'back' ) > -1 || direction.indexOf( 'front' ) > -1)
		var channel = '/FrontBack';

	if(channel)
		return this.postOnFaye( action, channel );
	return;
};

client.run = function() {
	this.configFaye();
	this.configLeap();
	this.controller.connect();
	this.getFrame();
};

client.run();