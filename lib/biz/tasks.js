"use strict";

var
    db        = require('../zsqlite'),
    async     = require('../async'),
    log       = require('../log').logger('biz/tasks'),
    datetime  = require('../util/datetime');


// Get the sum of time for each user for the current day
exports.getTodaysTimesByUser = function(users,handler) {

    var
        total = 0;

    // Get the existing task list
    var binDate = getToday();
//  db.instance("default").find("daylog",{Date:binDate},{},{},function(err,rows){
    db.instance("default").find("SELECT * FROM daylog WHERE Date=datetime(?)",[binDate.toJSON()],function(err,rows){
        if ( err ) {
            console.log("Error getting today's times: ",err);
            return handler(err,null);
        }

        // Convert time to string and g the total time
        rows.forEach(function(row){
            total += row.Time;
//          row.Time = minutesToStr(row.Time);
        });

        // Sum all the rows by username
        var
            timesByUser = {};
        rows.forEach(function(row){
            if ( timesByUser[row.Username] == null )
                timesByUser[row.Username] = 0;
            timesByUser[row.Username] += row.Time;
        });
        for ( var user in users ) {
            if ( timesByUser[user] == null )
                timesByUser[user] = 0;
        }

        return handler(null,timesByUser);
    });

};


// Get the list of problems, possibily filtered by name and user
exports.getProjects = function(filters,handler) {

    var
        filter = {};

    if ( filters && filters.name ) {
        try {
            filter.Task = new RegExp("^"+filters.name,"i");
        }
        catch(ex){}
    }
    if ( filters.user )
        filter.Username = filters.user;

    return db.instance("default").find("SELECT DISTINCT Task FROM daylog",function(err,projectList){
        if ( err ) {
            console.log("ERROR: Error getting project list with the query "+JSON.stringify(filter)+": ",err);
            return handler(err,null);
        }

        var
            projects = [];
        projectList.forEach(function(p){
            projects.push(p.Task);
        });
        return handler(null,projects);
    });

};

// Get the most used projects
exports.getTopProjects = function(username, days, entries, handler) {

    var
        userSQL = username ? "Username=? AND " : "",
        args    = username ? [username] : null,
        sql     = "SELECT COUNT(Task) AS top,Task FROM daylog WHERE "+userSQL+"Date > datetime('now', '-"+(days || 7)+" days') GROUP BY Task ORDER BY top DESC LIMIT "+(entries || 10);

    return db.instance("default").find(sql,args,function(err,projectList){
        if ( err ) {
            console.log("ERROR: Error getting top projects"+(username?" for user"+username:"")+": ",err);
            return handler(err,null);
        }

        var
            projects = [];
        projectList.forEach(function(p){
            if ( p.top == 0 )
                return;
            projects.push(p.Task);
        });
        return handler(null,projects);
    });

};


// Get current task for a specific user
exports.getCurrentTask = function(user,handler) {

    log.info("Getting user '"+user+"' current task...");

    // Get user daylog
    return this.list({Username:user,Date:getToday()},[["OrderNumber",1]],function(err,tasks){
        if ( err ) {
            log.error("Error getting tasks list: ",err);
            return handler(err,null);
        }

        if ( tasks.length == 0 ) {
            log.info("No tasks for user '"+user+"' for today, no current task");
            return handler(null,null);
        }


        // Find the last open task
        var
            openTask;
        tasks.forEach(function(task){
            if ( task.Notes ) {
                var tNotes = parseTaskNotes(task.Notes);
                tNotes.times.forEach(function(range){
                    if ( range.s && !range.e )
                        openTask = task;
                });
            }
        });
        if ( openTask ) {
            log.info("Returning task '"+openTask.Task+"' as user '"+user+"' current task because it's currently open");
            return handler(null,openTask);
        }


        // Return the last task
        var task = tasks[tasks.length-1];
        log.info("Returning task '"+task.Task+"' as user '"+user+"' current task because it's the last one");
        return handler(null,task);
    });

};

/*
// Get current task for a specific user
exports.getCurrentTask = function(user,handler) {

    // Get current task
    return db.instance("default").findOne("currentTask",{Username:user},function(err,task){
        if ( err ) {
            console.log("ERROR: Error getting current task for '"+user+"': ",err);
            return handler({error:"EDBQ1",description:err.toString()},null);
        }

        // If task DateTime is not from today, remove it and tell that we have no current task
        if ( task ) {
            var tDate = task.DateTime;
            zeroHours(tDate);
            if ( tDate.toString() != getToday().toString() ) {
                log.info("Current task is from yesterday, removing and ignoring..");
                db.instance("default").remove("currentTask",{_id:task._id},function(){});
                task = null;
            }
        }

        return handler(null,task);
    });

};

// Set current task for a specific user
exports.setCurrentTask = function(user,task,handler) {

    log.info("Setting user '"+user+"' current task to "+task.Task+" ...");

    // Get current task for this user
    return this.getCurrentTask(user,function(err,ctask){
        if ( err ) {
            console.log("ERROR: Error getting current task for '"+user+"': ",err);
            return handler(err,null);       
        }

        if ( ctask ) {
            ctask.TaskName = task.Task;
            ctask.TaskID = task._id;
            ctask.DateTime = new Date();

            return db.instance("default").update("currentTask",{Username:user},ctask,function(err,ok){
                if ( err ) {
                    console.log("ERROR: Error updating user '"+user+"' current task on database: ",err);
                    return handler(err,null);
                }

                return handler(null,ctask);
            });
        }
        else {

            var ctask = {
                Username:   user,
                DateTime:   new Date(),
                TaskName:   task.Task,
                TaskID:     task._id
            };
            return db.instance("default").insert("currentTask",ctask,function(err,ok){
                if ( err ) {
                    console.log("ERROR: Error inserting user '"+user+"' current task on database: ",err);
                    return handler(err,null);
                }

                log.info("User '"+user+"' current task successfully set to '"+task.Task+"'");

                return handler(null,ctask);
            });

        }
    });

};
*/


// Open a task
exports.openTask = function(user, taskName, handler) {

    var
        today    = getToday(),
        now      = getNow(),
        task;

    if (typeof taskName == 'object')
        taskName = taskName.Task;

    log.info("Opening task '"+taskName+"' at "+now+"...");

    // Task is a string, locate or create it. In other case, just keep going..
    return async.ifThen(typeof taskName == "string",

        // Locate and eventually create it
        function(next) {

            // Locate it
            // return db.instance("default").find("SELECT * FROM daylog WHERE Username=? AND Date=datetime(?) AND Task=? ORDER BY OrderNumber DESC",[user,today.toJSON(),task],{},function(err,ftasks){
            //     if ( err ) {
            //         log.error("Error trying to locate an eventually existent task named '"+task+"': ",err);
            //         return handler(err,null);
            //     }

            //     // Found the task? Cool! No? Later we will insert!
            //     task = ftasks[0];
            //     return next();
            // });
            // Always add a task
            next();

        },

        function() {

            // Has no task? Insert it!
            if ( task == null ) {

                // Count the tasks for today
                return exports.getUserDaylog(user, today, function(err, tasks) {
                    if ( err ) {
                        log.error("Error getting the tasks for today in order to make the OrderNumber");
                        return handler(err, null);
                    }

                    // Didn't find the task, create it.
                    var ntask = {
                        Username:    user,
                        Date:        today,
                        Task:        taskName,
                        Time:        1,
                        Notes:       now+" - :",
                        OrderNumber: tasks.length + 1,
                    };
                    return db.instance("default").insert("daylog",[ntask],function(err,res){
                        if ( err ) {
                            log.error("Error inserting task '"+task+"' on database: ",err);
                            return handler(err,null);
                        }

                        // Find it
                        task = ntask;
                        return handler(null,ntask);
                    });
                });

            }

            // Edit task notes and save it
            else {

                // Edit task notes
                var
                    tNotes = parseTaskNotes(task.Notes);

                if ( !tNotes.times )
                    tNotes.times = [];

                tNotes.times.push({s:now});
                task.Notes = formatTaskNotes(tNotes);

                // Save it
                return db.instance("default").operation("UPDATE daylog SET Notes=? WHERE id=?",[task.Notes,task._id],function(err,ok){
//              return db.instance("default").update("daylog",{_id:task._id},task,function(err,ok){
                    if ( err ) {
                        log.error("Error updating task '"+task._id+"' for opening it: ",err);
                        return handler(err,null);
                    }

                    log.info("Task '"+task.Task+"' successfully openned");
                    return handler(null,task);
                });
            }

        }
    );

};


// Close a task
exports.closeTask = function(user,task,handler) {

    var
        today    = getToday(),
        now      = getNow(),
        taskName = (typeof task == "string")?task:task.Task;


    log.info("Closing task '"+(typeof task == "string"?task:task.Task)+"' at "+now+"...");

    // Task is a string, locate or create it. In other case, just keep going..
    return async.ifThen(typeof task == "string",

        // Locate and eventually create it
        function(next) {

            // Locate it
//          return db.instance("default").find("daylog",{Username: user, Date: today, Task: taskName},{},{sort:[['OrderNumber',-1]]},function(err,ftasks){
            return db.instance("default").find("SELECT * FROM daylog WHERE Username=? AND Date=datetime(?) AND Task=? ORDER BY OrderNumber DESC",[user,today.toJSON(),taskName],function(err,ftasks){
                if ( err ) {
                    log.error("Error trying to locate an eventually existent task named '"+task+"': ",err);
                    return handler(err,null);
                }

                // Found the task? Cool! No? Forget!
                if ( ftasks.length == 0 ) {
                    log.info("Task not found, ignoring...");
                    return handler(null,null);
                }

                task = ftasks[0];
                return next();
            });

        },

        function() {

            // Has no task? Insert it!
            if ( task == null ) {

                // Didn't find the task, create it.
                var ntask = {
                    Username:   user,
                    Date:       today,
                    Task:       taskName,
                    Time:       1,
                    Notes:      " - "+now+": "
                };
                return db.instance("default").insert("daylog",[ntask],function(err,res){
                    if ( err ) {
                        log.error("Error inserting task '"+task+"' on database: ",err);
                        return handler(err,null);
                    }

                    // Find it
                    task = ntask;

                    log.info("A new closed task named '"+ntask.Task+"' was created.");
                    return handler(null,ntask);
                });

            }

            // Edit task notes and save it
            else {
                log.info("The task was found: ",JSON.stringify(task));

                // Edit task notes
                var
                    tNotes = parseTaskNotes(task.Notes);

                if ( !tNotes.times )
                    tNotes.times = [];

                // Is the last entry open
                if ( tNotes.times.length > 0 && tNotes.times[tNotes.times.length-1].e == null )
                    tNotes.times[tNotes.times.length-1].e = now;
                else {
                    tNotes.times.push({e:now});
                }
                tNotes.totalTime = calculateTaskTimes(tNotes.times);
                task.Notes = formatTaskNotes(tNotes);
                task.Time  = tNotes.totalTime;

                // Save it
//              return db.instance("default").update("daylog",{_id:task._id},task,function(err,ok){
                return db.instance("default").operation("UPDATE daylog SET Notes=?, Time=? WHERE _id=?",[task.Notes,task.Time,task._id],function(err,ok){
                    if ( err ) {
                        log.error("Error updating task '"+task._id+"' for opening it: ",err);
                        return handler(err,null);
                    }

                    log.info("Task '"+taskName+"' successfully closed");
                    return handler(null,task);
                });
            }
        }
    );

};

// Switch to a task
exports.switchTask = function(user, newTask, handler) {

    var
        self = this,
        taskName = ((typeof newTask == "string")?newTask:newTask.Task);

    log.info("Switching user '"+user+"' task to '"+taskName+"'...");

    // Get current task
    return self.getCurrentTask(user, function(err,curTask){
        if ( err ) {
            log.error("Error getting user '"+user+"' current task: ",err);
            return handler(err,null);
        }

//      console.log("Current task: ",curTask);
        if ( curTask && curTask.Task.toLowerCase().trim() == taskName.toLowerCase().trim() ) {
            log.info("New and current task are the same. Skipping...");
            return handler(null, curTask);
        }

        // If there's a current task, close it
        return async.ifThen(curTask,

            // Close the current task
            function(next){
                return self.closeTask(user,curTask.Task,function(err,ok){
                    if ( err ) {
                        log.error("Error closing user '"+user+"' task '"+curTask.Task+"': ",err);
                        return handler(err,null);
                    }
                    return next();
                });
            },

            // Open the new task
            function(){
                return self.openTask(user, newTask,function(err,task){
                    if ( err ) {
                        log.error("Error opening user '"+user+"' task '"+taskName+"': ",err);
                        return handler(err,null);
                    }
/*
                    // Set the new task as the current one
                    return self.setCurrentTask(user,task,function(err,ok){
                        if ( err ) {
                            log.error("Error setting task '"+taskName+"' as the current task of '"+user+"': ",err);
                            return handler(err,null);
                        }
*/
                    log.info("Successfully switched user '"+user+"' task to '"+taskName+"'");
                    return handler(null,task);
//                  });
                });
            }
        );
    });

};


// Get user day log
exports.getUserDaylog = function(user,date,handler) {

    var
        binDate = date;

    log.info("Getting user '"+user+"' daylog for '"+date.toString()+"'...");

    if ( typeof binDate == "string" ) {
        binDate = datetime.fromString(binDate);
    }

    return this.list({Username:user,Date:binDate},[["Notes",1], ["OrderNumber",1]],function(err,tasks){
        if ( err ) {
            log.error("Error getting tasks list: ",err);
            return handler(err,null);
        }

        log.info("Returning "+tasks.length+" tasks as user '"+user+"' daylog");
        return handler(null,tasks);
    });

};


// Set the suer day log
exports.setUserDaylog = function(user,date,tasks,handler) {

    var
        binDate = date;


    log.info("Setting user '"+user+"' daylog of '"+date.toString()+"' to "+tasks.length+" tasks...");

    if ( typeof binDate == "string" ) {
        binDate = datetime.fromString(binDate);
    }

    // Put order numbers on the rows
    var idx = 1;
    tasks.forEach(function(row){
        row.OrderNumber = idx++;
    });

    // Remove existing rows for this date
//  return db.instance("default").remove("daylog",{Username:user,Date:date},function(err,ok){
    return db.instance("default").operation("DELETE FROM daylog WHERE Username=? AND Date=datetime(?)",[user,date.toJSON()],function(err,ok){
        if ( err ) {
            console.log("Error removing existing rows for user "+user+" on "+date.toString()+": ",err);
            return spritz.json(req,res,{error:"Error removing existing rows for this user and day"},500);
        }

        // Save them
        if ( tasks.length == 0 )
            return handler(null,0);

        // Insert new rows
        return db.instance("default").insert("daylog",tasks,{},function(err,stored){
            if ( err ) {
                console.log("Error inserting user "+user+" rows on daylog for "+date.toString()+": ",err);
                return handler(err,null);
            }

            log.info("User '"+user+"' daylog of '"+date.toString()+"' successfully set");
            return handler(null,stored);
        });
    });

};


// List tasks
exports.list = function(filter,sort,handler) {

    log.info("Listing tasks using filter ",JSON.stringify(filter)+" and sort "+JSON.stringify(sort));

    if ( !filter )
        filter = {};
    if ( !sort )
        sort = [['Notes',1]];

//  return db.instance("default").find("daylog",filter,{},{sort:sort},function(err,tasks){
    var
        q = "",
        vs = [],
        s = "";
    for ( var k in filter ) {
        if ( filter[k] instanceof Date ) {
            q += k+"=datetime(?) AND ";
            vs.push(filter[k].toJSON());
        }
        else if ( typeof filter[k] == "object" ) {
           if ( filter[k]['$lt'] ) {
                   q += k+"<datetime(?) AND ";
                   vs.push(filter[k]['$lt'].toJSON());
           }
           if ( filter[k]['$lte'] ) {
                   q += k+"<=datetime(?) AND ";
                   vs.push(filter[k]['$lte'].toJSON());
           }
           if ( filter[k]['$gt'] ) {
                   q += k+">datetime(?) AND ";
                   vs.push(filter[k]['$gt'].toJSON());
           }
           if ( filter[k]['$gte'] ) {
                   q += k+">=datetime(?) AND ";
                   vs.push(filter[k]['$gte'].toJSON());
           }
        }
        else {
            q += k+"=? AND ";
            vs.push(filter[k]);
        }
    }
    if ( q.length > 0 )
        q = "WHERE "+q.substr(0,q.length-5);

    sort.forEach(function(clause){
        s += clause[0] + ((clause[1] == -1)?" DESC":" ASC")+",";
    });
    if ( s.length > 0 )
        s = " ORDER BY "+s.substr(0,s.length-1);

    log.info("Report query SELECT * FROM daylog "+q+s,"(VALUES ",vs,")");
    return db.instance("default").find("SELECT * FROM daylog "+q+s,vs,function(err,tasks){
        if ( err ) {
            log.error("Error getting task list from database: ",err);
            return handler(err,null);
        }

        log.info("Returning "+tasks.length+" resulting tasks...");
        return handler(null,tasks);
    });

};


// Useful stuff

function parseTaskNotes(notes) {

    var
        times = [];

    while ( notes && notes.match(/^\s*\(?(\d{1,2}:\d{1,2})? +[àÀáÀa\-]s? (\d{1,2}:\d{1,2})?\)?[\s\r\n:]*/) ) {
        var
            s = RegExp.$1||null,
            e = RegExp.$2||null;

        times.push({s: s, e: e});

        if ( s && e ) {
        }
        notes = notes.replace(/^\s*\(?(\d{1,2}:\d{1,2})? +[àÀáÀa\-]s? (\d{1,2}:\d{1,2})?\)?[\s\r\n:]*/,"");
    }

    return {
        times:      times,
        totalTime:  calculateTaskTimes(times),
        text:       notes
    };

}

function calculateTaskTimes(times) {

    var
        total = 0;

    times.forEach(function(t){
        if ( t.s && t.e ) {
            var
                sTime = parseTime(t.s),
                eTime = parseTime(t.e);
            if ( sTime != null && eTime != null ) {
                if ( eTime < sTime )
                    eTime += 1440;
                total += eTime-sTime;
            }
        }
    });

    return total;

}

function parseTime(timeStr) {

    if ( !timeStr.match(/^\s*(\d{1,2}):(\d{1,2})\s*$/) )
        return null;

    var
        m = RegExp.$1,
        s = RegExp.$2;

    return parseInt(m)*60+parseInt(s);

}

function formatTaskNotes(data) {

    var
        str = "";

    if ( data.times && data.times.length > 0 ) {
        data.times.forEach(function(period){
            str += (period.s?(period.s+" "):" ") + "-" + (period.e?(" "+period.e):" ") + "\n";
        });
        str = str.substr(0, str.length - 1) + ": ";
    }
    if ( data.text )
        str += data.text;

    return str;

}

function getToday() {

    var
        now = new Date(),
        strDate = (parseInt(now.getYear()+1900)+"-"+parseInt(now.getMonth()+1)+"-"+now.getDate());

    return datetime.fromString(strDate);

}

function zeroHours(d) {
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
}

function getNow() {

    var
        now = new Date(),
        h   = now.getHours(),
        m   = now.getMinutes();

    if ( h < 10 )
        h = "0"+h;
    if ( m < 10 )
        m = "0"+m;

    return h+":"+m;

}
