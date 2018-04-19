'use strict';

// AUTHOR : ANIKETHA KATAKAM
var express = require('express'); 
var socket = require('socket.io'); 
var fs = require('fs');
var server = express();

server.use('/', express.static(__dirname + '/'));

var io = socket(server.listen(8080));

var objectClients = [];
var objclients = {};

io.on('connection', function(objectSocket) {
	
	var arr;
	var word;
	var guessword = null;
	var multiWord;
	var multi_guessword = null;

   /**
       When a single player option is selected this event is emitted from the client
       **/
       objectSocket.on('single', function(objectData) {

//Reading the words from the file
//https://docs.nodejitsu.com/articles/file-system/how-to-read-files-in-nodejs/
fs.readFile('data.txt', 'utf8', function (err,data) {
	if (err) {
		return console.log(err);
	}
			//splitting the comma seperated values
			arr = data.split(",");
			//picking a random word from the array
			word = arr[Math.floor(Math.random()*arr.length)];
			console.log("picked word  :" +word);  
			objectSocket.emit('single', {'word': word});

            //flag value is used when play again value is clicked for resetting the game
            if(objectData.flag === "set")
            	guessword =null;

			//getting the random word's length and creating a guess string for the user
			for(var i=0; i < word.length ; i++ ){
				var dash = "_ ";
				
				if(guessword === null)
					guessword = dash;
				else
					guessword = guessword + dash;
			}
			//The generated word to guess is sent to the client
			objectSocket.emit('word', {'guessStr': guessword});

		});

});

    /**
      *When an onscreen keyboard button is clicked this event is triggered
      **/
      objectSocket.on('guess', function(objectData) {

      	var search = objectData.alpha;
      	var updated=[];
      	var updatedStr='';
      	var existingWord=objectData.word;
      	var count=objectData.count;
      	var initial=0; 
      	var dcount=0;
		//The word with dashes is passed from client screen, which the user is guessing.
		//any spaces from it are removed
		var existingWord = existingWord.replace(/\s/g,'');

		//checking the answer word with the alphabet clicked by user
		for(var i=0 ; i < existingWord.length ; i++ ) {

            //calculating existing dashes in the word which is sent by the client 
            if(existingWord[i]==="_")
            	initial++;

            console.log(word[i]);

			//if an alphabet clicked by the user is matching any character from the answer string then push it onto an array
			if(word[i] === search.toLowerCase()) {
				updated.push(search);
			}
			else {
				//if there are any existing alphabets which were already guessed previously, push that into the array as well
				if(existingWord[i] !== "_")
					updated.push(existingWord[i]);
				//if there is no match then push a dash(underscore)
				else
					updated.push("_");
			}

		}
		console.log(updated);
        //building an updated string from the pushed array elements to send back to the client. 
        for(var x=0 ; x< updated.length ; x++)
        {

        	updatedStr += " " + updated[x] + " ";

            //counting the dashes count again after the string is updated
            if(updated[x]==="_")
            	dcount++;
        }
        console.log(updatedStr);
        
        //if the initial count and the count after updating the string are same then there wasn't any match
        // for the clicked alphabet so reduce the count of the number of chances left for the user
        if(initial===dcount)
        	count--;
		//passing back the updated string and updated number of chances left
		objectSocket.emit('guessUpdate', {'updatedStr': updatedStr , 'updatedCount' : count });
	});


    /**
      *Host has passed the word to guess for the 2nd player
      *
      **/
      objectSocket.on('hostWord', function(objectData) {
      	multiWord = objectData.mpword;
      	console.log(multiWord);

		//sending a provate message to the respective client with the hint and word to guess
		objclients[objectData.myclient_id].objectSocket.emit('WFHost', {'multiguess': multiWord , 'hint' : objectData.hint});

        //building a string with dashes for the 2nd player to guess
        for(var i=0; i < multiWord.length ; i++ ){
        	var dash = "_ ";

        	if(multi_guessword === null)
        		multi_guessword = dash;
        	else
        		multi_guessword = multi_guessword + dash;
        }
        console.log(multi_guessword);
		//passing the guess string to the 2nd player to guess
		objclients[objectData.myclient_id].objectSocket.emit('multi_word', {'guessStr': multi_guessword});

	});

    /**
      *Event triggered when two player button is clicked on the landing page
      **/
      objectSocket.on('twoPlayer', function(objectData) {

		//Random ID generated for the user who is connected in the 2 player game
		objectSocket.strIdent = Math.random().toString(36).substr(2, 8)
		objectSocket.emit('hello', {
			'strIdent': objectSocket.strIdent
		});
		//adding the new player into an array
		objectClients.push(objectSocket.strIdent);
		//adding the new player into an object which is used for sending private messages to the player 
		objclients[objectSocket.strIdent]= {
			'strIdent': objectSocket.strIdent,
			'objectSocket': objectSocket
		};
		console.log(objectSocket.strIdent);
		console.log("value " +(objectClients.length%2));	
		//finding the length of the array of connected users 
		var len = objectClients.length
		//if length modulo 2 gives 0 then display the player page
		//else display host page
		if((objectClients.length) % 2 === 0 ) {
			
			//passing the host and host's client id , the client and client's host id to each other
			objclients[objectClients[len-1]].objectSocket.emit('self_id',{'id' :  objectClients[len-1] , 'my_host' : objectClients[len-2] });
			objclients[objectClients[len-2]].objectSocket.emit('host_id',{'id' :  objectClients[len-2] , 'my_client' : objectClients[len-1] });

			objectSocket.emit('hostPlayer', {'name': objectData.name,'guessWord':multiWord} );
		}
		else{
			objectSocket.emit('host', {'name': objectData.name,'guessWord':multiWord});		
		}
	});

    /*
    Notifying the host that a client got connected 
    */
    objectSocket.on("notifyHost",function(objectData) {
    	console.log(objectData.my_host + "   my id sent by client with id   "+ objectData.my_id);
    	objclients[(objectData.my_host)].objectSocket.emit('message', {'something':"hi from player"});
    });
    
    //The alphabet clicked by the player is sent to the client which is forwarded to the host
    objectSocket.on("multi_guess",function(objectData) {
    	objclients[(objectData.my_host)].objectSocket.emit('word_check',{'multi_alpha': objectData.multi_alpha , 'multi_word' : objectData.multi_word , 'multi_count': objectData.multi_count });      
    });
    objectSocket.on("multi_wordcheck",function(objectData) {
    	var entered_char = objectData.alpha_entered;
    	var current_word = objectData.current_word;
    	var current_count = objectData.current_count;
    	var final_word = objectData.word;
    	var updated=[];
    	var updatedStr='';
    	var initial=0; 
    	var dcount=0;
          //The word with dashes is passed from client screen, which the user is guessing.
		  //any spaces from it are removed
		  current_word = current_word.replace(/\s/g,'');
         //checking the answer word with the alphabet clicked by user
         for(var i=0 ; i < current_word.length ; i++ ) {
         //calculating existing dashes in the word which is sent by the client 
         if(current_word[i]==="_")
         	initial++;
        //if an alphabet clicked by the user is matching any character from the answer string then push it onto an array
        console.log(final_word[i]);
        if(final_word[i].toLowerCase() === entered_char.toLowerCase()) {
        	updated.push(entered_char);
        }
        else {
		//if there are any existing alphabets which were already guessed previously, push that into the array as well
		if(current_word[i] !== "_")
			updated.push(current_word[i]);
		else
		  //if there is no match then push a dash(underscore)
		updated.push("_");
	}

}
console.log(updated);
           //building an updated string from the pushed array elements to send back to the client. 
           for(var x=0 ; x< updated.length ; x++)
           {
           //counting the dashes count again after the string is updated
           updatedStr += " " + updated[x] + " ";

           if(updated[x]==="_")
           	dcount++;
       }
       console.log(updatedStr);
           //if the initial count and the count after updating the string are same then there wasn't any match
           // for the clicked alphabet so reduce the count of the number of chances left for the user
           if(initial===dcount)
           	current_count--;

           console.log("final "+ final_word.toLowerCase());
           console.log("updated  "+ updatedStr.toLowerCase().replace(/\s/g,''));

           //checking if the final answer is matching the current guess word status
           if( final_word.toLowerCase() ===  updatedStr.toLowerCase().replace(/\s/g,''))
           {
            //If it matches then send the updated string,chances left, game over flag as "win" and the final answer to both the host and player
            objclients[(objectData.client_id)].objectSocket.emit('multi_guessUpdate', {'multi_updatedStr': updatedStr , 'multi_updatedCount' : current_count , 'game_over' : "win" , 'answer' : final_word });        
            objclients[(objectData.my_id)].objectSocket.emit('Host_guessUpdate', {'multi_updatedStr': updatedStr , 'multi_updatedCount' : current_count , 'game_over' : "win" , 'answer' : final_word });        
        }
           //if the available tries count is less than 1 
           else if (current_count < 1 )
           {
            //If count is < 1 then send the updated string,chances left, game over flag as "lose" and the final answer 
            objclients[(objectData.client_id)].objectSocket.emit('multi_guessUpdate', {'multi_updatedStr': updatedStr , 'multi_updatedCount' : current_count , 'game_over' : "lose" , 'answer' : final_word });        	
            objclients[(objectData.my_id)].objectSocket.emit('Host_guessUpdate', {'multi_updatedStr': updatedStr , 'multi_updatedCount' : current_count , 'game_over' : "lose" , 'answer' : final_word });        	
        }
        else {
            //If count is not less than 1 and the final aswer is not equal to guess word sttaus then send the updated string,chances left
            //, game over flag as "not yet" and the final answer as null
            objclients[(objectData.client_id)].objectSocket.emit('multi_guessUpdate', {'multi_updatedStr': updatedStr , 'multi_updatedCount' : current_count , 'game_over' : "Not yet" , 'answer' : null });        	
            objclients[(objectData.my_id)].objectSocket.emit('Host_guessUpdate', {'multi_updatedStr': updatedStr , 'multi_updatedCount' : current_count , 'game_over' : "Not yet" , 'answer' : null });        	
        }


    });


});