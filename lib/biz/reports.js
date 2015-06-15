"use strict";

var
    db  = require('../zsqlite'),
    log = require('../log').logger('biz/reports');


// Get last report
exports.getLastReport = function(handler) {

    log.info("Getting last report");

    // Query the database
    return db.instance("default").find("SELECT * FROM reports ORDER BY Date DESC LIMIT 1",function(err,rows){
//    return db.instance("default").find("reports",{},{},{sort:[['Date',-1]],limit:1},function(err,rows){
        if ( err ) {
            console.log("ERROR: Error querying database for the last report: ",err);
            return handler(err,null);
        }

        if ( rows.length == 0 ) {
            log.info("There is no last report, returning null");
            return handler(null,null);
        }

        log.info("Returning last report");
        return handler(null,rows[0]);
    });

}


// Register a report
exports.report = function(report,handler) {

    log.info("Registering report ",report);

    // Insert on database
    return db.instance("default").insert("reports",[report],function(err,ok){
        if ( err ) {
            console.log("Error registering report on database: ",err);
            
        }

        log.info("Report successfully registered");
        return handler(null,report);
    });

};
