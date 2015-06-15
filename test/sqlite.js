var
	db = require('../lib/zsqlite');

db.instance("default").operation("CREATE TABLE Test (x int not null)",function(err){
	if ( err ) {
		console.log("ERR#1: ",err);
//		return process.exit(-1);
	}

	db.instance("default").operation("INSERT INTO Test VALUES (?)",[99],function(err){
		if ( err ) {
			console.log("ERR#2: ",err);
			return process.exit(-1);
		}

		db.instance("default").find("SELECT * FROM Test",function(err,data){
			if ( err ) {
				console.log("ERR#3: ",err);
				process.exit(-2);
			}

			console.log("data: ",data);
			db.instance("default").operation("DROP TABLE Test",function(err){
				process.exit(0);
			});
		});
	});
});
