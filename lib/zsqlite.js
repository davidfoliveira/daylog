"use strict";

var
    log     = require('./log').logger("zsqlite"),
    conf    = require('./conf').get("db"),

    util    = require('util'),
    events  = require('events'),
    async   = require('async'),
    sqlite3 = require('sqlite3'),
    object  = require('./util/object'),

    _instanceCache = { },
    _waitingDBCallbacks = [];


// Connect to database
// Syntax:
//    .open(callBack)

var open = function(handler) {

    var
        self = this,
        opts = { };

    // Validation
    if ( !self || !self._conf )
        return handler ? handler(new Error("No configuration")) : null;
    if ( self._conf.path == null )
        return handler ? handler(new Error("Instance path not configured")) : null;

    // Options
    if ( self._conf.opts )
        opts = self._conf.opts;

    log.INFO(self._instance+": Openning database \"connection\" to "+self._conf.path+"...");

    // Connect callback
    self._connecting = true;
    self._client = null;
    self._db = null;
    self._started = new Date();
    var cb = function(err){
        self._connecting = false;
        if ( !err )
            log.INFO(self._instance+": Connected! (after "+(new Date()-self._started)+" ms)");
        else
            log.ERROR(self._instance+": Error connecting (after "+(new Date()-self._started)+" ms): ",err);

        // Notify who requested a database

        while ( _waitingDBCallbacks.length ) {
            var wcb = _waitingDBCallbacks.shift();
            wcb(err);
        }
        return handler(err,self);
    };

    // Connect
    try {
        self._db = new sqlite3.Database(self._conf.path, opts.mode || sqlite3.OPEN_READWRITE, cb);
    }
    catch(ex){
        return handler(ex,null);
    }

    return self;

};


// Disconnect
// Syntax:
//  .close([force,][handler]);

var close = function(handler) {

    var
        self = this;

    log.info(self._instance+": Closing database connection");

    self._db.close(function(err){
        log.info(self._instance+": Closed database connection.");
        self._db = null;
        if ( handler )
            return handler(err);
    });

    return self;

};


// Check if database connection is open
var ensureConnection = function(handler) {

    var
        self = this;

    if ( self._db )
        return handler(null,self._db);

    if ( !self._connecting )
        return self.open(handler);
    else
        _waitingDBCallbacks.push(handler);


};


// Find and return an array with the results
// Syntax:   find(query[,values[,opts],callBack)
// Callback: function(err,docs)

var find = function(query,values,handler) {

    var
        self = this,
        args = Array.prototype.slice.call(arguments,0,4),
        rows = [];

    // Check arguments
    handler     = args.pop()    || _error("No callback");
    query       = args.shift()  || _error("No query");
    values      = args.shift()  || [];

    // Find
    self.findCursor(query,values,function(err,row){
        if ( err ) {
            log.error("Cursor error: ",err);
            return handler({where: "zsqlite", type: "hard", code: "ECURSERR", description: err.toString()},null);
        }

        if ( row )
            return rows.push(row);
        return handler(null,rows);
    });

    return self;

};


// Find and return a cursor
// Syntax:   findCursor(table[,query[,fields[,opts]]],callBack)
// Callback: function(err,cursor)

var findCursor = function(query,values,handler) {

    var
        self = this,
        args = Array.prototype.slice.call(arguments,0,4);

    // Check arguments
    handler     = args.pop()    || _error("No callback");
    query       = args.shift()  || _error("No query");
    values      = args.shift()  || []

    // Ensure a database "connection"
    self.ensureConnection(function(err){
        if ( err ) {
            log.error(self._instance+": Error getting connected to the database: ",err);
            return handler(err,null);
        }

        // Perform the query
        log.info(self._instance+": Performing query "+query+" (values: "+JSON.stringify(values)+")");
        return self._db.each(query,values,
            function(err,data){
                if ( err ) {
                    console.log("Database cursor error: ",err);
                    return handler(err,null);
                }
                return handler(null,data);
            },
            function(err){
                if ( err ) {
                    console.log("Database cursor error: ",err);
                    return handler(err,null);
                }
                return handler(null,null);
            }
        );
    });

    return self;

};


// Find and locally filter results
var findGrep = function(query,values,grepFn,handler) {

    var
        self = this,
        args = Array.prototype.slice.call(arguments,0,6),
        rows = [];

    // Check arguments
    handler     = args.pop()    || _error("No callback");
    query       = args.shift()  || _error("No query");
    grepFn      = args.pop()    || function(){return true};
    values      = args.shift()  || [];

    self.findCursor(query,values,function(err,cursor){
        if ( err )
            return handler(err,null);

        cursor.each(function(err,row){
            if ( err ) {
                log.error("Cursor error: ",err);
                return handler({where: "core.db", type: "hard", code: "ECURSERR", description: err.toString()},null);
            }
            if ( row ) {
                if ( grepFn(row) )
                    rows.push(row);
                return;
            }
            return handler(null,rows);
        }); 
    });

    return self;

};



// Performs a database operation
// Syntax:   operation(statement,callback)
// Callback: function(err,docs)

var operation = function(statement,values,handler) {

    var
        self = this,
        args = Array.prototype.slice.call(arguments,0,5);

    // Check arguments
    handler     = args.pop()    || _error("No callback");
    statement   = args.shift()  || _error("No statement");
    values      = args.shift()  || [];

    // Ensure a database "connection"
    self.ensureConnection(function(err){
        if ( err ) {
            log.error(self._instance+": Error getting connected to the database: ",err);
            return handler(err,null);
        }

        // Perform the operation
        log.info(self._instance+": Performing operation '"+statement+"' (values: "+JSON.stringify(values)+")");
        var rv = self._db.run(statement,values,handler);
    });

    return self;

};


// Insert a bunch of documents
var insert = function(table,docs,opts,handler) {

    var
        self = this,
        args = Array.prototype.slice.call(arguments,0,5);

    // Check arguments
    handler     = args.pop()    || _error("No callback");
    table       = args.shift()  || _error("No table");
    docs        = args.shift()  || [];
    opts        = args.shift()  || {};

    if ( docs.length == 0 ) {
        log.info("Nothing to insert");
        return handler(null,[]);
    }

    // Prepare the inserts
    var
        inserts = [],
        keys    = Object.keys(docs[0]);

    docs.forEach(function(doc){
        var
            insert = "INSERT INTO "+table+" (",
            vals   = [];

        keys.forEach(function(k){
            insert += k+",";
        });
        insert = insert.substr(0,insert.length-1)+") VALUES (";
        keys.forEach(function(k){
            if ( doc[k] instanceof Date ) {
                insert += "datetime(?),";
                vals.push(doc[k].toJSON());
            }
            else {
                insert += "?,";
                vals.push(doc[k]);
            }
        });
        insert = insert.substr(0,insert.length-1)+")";
        inserts.push({sql:insert,vals:vals});
    });

    return async.mapSeries(inserts,
        function(insert,next){
            self.operation(insert.sql,insert.vals,function(err,res){
                if ( err ) {
                    log.error("Error performing insert '"+insert.sql+"' ("+JSON.stringify(insert.vals)+")");
                    return next(err,null);
                }
                return next(null,res);
            });
        },
        function(err,res){
            if ( err ) {
                log.error("Error performing bulk inserts: ",err);
                return handler(err,null);
            }
            return handler(null,res);
        }
    )

};

// A database instance
function Instance(name, config){
    this._client     = null;
    this._db         = null;
    this._connecting = null;
    this._instance   = null;
    this._conf       = config;

    // Methods
    this.open             = open;
    this.connect          = open;
    this.close            = close;
    this.disconnect       = close;
    this.ensureConnection = ensureConnection;
    this.query            = find;
    this.operation        = operation;
    this.insert           = insert;
    this.find             = find;
    this.findCursor       = findCursor;
    this.findGrep         = findGrep;
}
util.inherits(Instance, events.EventEmitter);


// Get a database instance
var instance = function(name, _conf) {
    if ( !_conf && (conf.instances == null || conf.instances[name] == null) ) {
        throw new Error("Database instance does not exist");
        return null;
    }

    if ( conf.instances[name].type != "SQLite3" ) {
        throw new Error("Supplied instance is not an SQLite3 instance (type)");
        return null;
    }

    if ( _instanceCache[name] )
        return _instanceCache[name];

    _instanceCache[name] = new Instance(name, _conf || conf.instances[name]);
    return _instanceCache[name];
};


// Util functions

var _error = function(msg){
    throw new Error(msg);
};

exports.instance = instance;
exports.db       = instance;
