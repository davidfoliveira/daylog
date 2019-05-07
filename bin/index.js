#!/usr/bin/env node

"use strict";

var
    async       = require('async'),
    spritz      = require('spritz'),
    log         = require('../lib/log').logger('index'),
//  SMTPC       = require('smtp-connection'),
    bizTasks    = require('../lib/biz/tasks'),
    bizReports  = require('../lib/biz/reports'),
    datetime    = require('../lib/util/datetime'),
    conf        = require('../conf/daylog.conf');


// Start the server
spritz.start({
    port: 8090
});

spritz.use(require('spritz-jstemplate'));

// Basic auth handler
var authCheck = function(u,p,cb){
    if ( conf.auths[u] != null && p == conf.auths[u] )
        return cb(null,true);
    return cb(null,false);
};


// Public
spritz.on(/^\/services\/today$/,{auth: authCheck},function(req,res){

    var
        today = new Date(),
        strDate = (parseInt(today.getYear()+1900)+"-"+parseInt(today.getMonth()+1)+"-"+today.getDate()),
        total = 0;

    // Get the existing task list
    return bizTasks.getTodaysTimesByUser(reportUsers,function(err,timesByUser){
        if ( err ) {
            console.log("Error getting times by user: ",err);
            return spritz.json(req,res,err,500);
        }
        return spritz.json(req,res,timesByUser);
    });

});

spritz.on('/services/projects',{auth: authCheck},function(req,res){

    var
        filter = {};

    return bizTasks.getProjects({name: req.args.filter, user: req.args.user},function(err,projects){
        if ( err ) {
            console.log("Error getting project list: ",err);
            return spritz.json(req,res,err,500);
        }

        return spritz.json(req,res,projects,200);
    });

});

spritz.on('/services/topprojects',{auth: authCheck},function(req,res){
    var
        user = req.args.user || req.authUser;

    return bizTasks.getTopProjects(user, 3, 10, function(err,projects){
        if ( err ) {
            console.log("Error getting project list: ",err);
            return spritz.json(req,res,err,500);
        }

        // Get the currently active project
        bizTasks.getCurrentTask(user, function(err, task){
            if ( err ) {
                console.log("Error getting current task: ", err);
                return spritz.json(req, res, err, 500);
            }

            return spritz.json(req,res,{
                projects,
                active: task ? task.Task : null
            },200);            
        });

    });

});


// Add a task and set as current task
spritz.on('/services/switch',{auth: authCheck}, function(req,res){

    var
        user = req.authUser,
        taskName = req.args.t;

    // Validation
    if ( !user )
        return spritz.json(req,res,{error:"ENOAUTH",description:"User not authenticated"},500);
    if ( !taskName || taskName.match(/^\s*$/) )
        return spritz.json(req,res,{error:"ENOTASK",description:"Please specify a task name (t=)"},500);

    // Get current task
    bizTasks.switchTask(user, taskName,function(err,task){
        if ( err ) {
            log.error("Error switching user '"+user+"' task: ",err);
            return spritz.json(req,res,{error:"ESWTSK",description:"Error switching user task",detail:err},500);
        }

        return spritz.json(req,res,{ok:true, task: task.Name, id: task._id});
    });

});

// Close a task and set as current task
spritz.on('/services/close', {auth: authCheck}, function(req,res){

    var
        user = req.authUser;

    // Validation
    if ( !user )
        return spritz.json(req,res,{error:"ENOAUTH",description:"User not authenticated"},500);

    // Get current task
    return bizTasks.getCurrentTask(user,function(err,ctask){
        if ( err ) {
            log.error("Error getting current user '"+user+"' task: ",err);
            return spritz.json(req,res,{error:"ENOTASK",description:"There is no current task assigned to this user and for current day"},200);
        }

        // Close it
        return bizTasks.closeTask(user,ctask,function(err,task){
            if ( err ) {
                log.error("Error closing user '"+user+"' task: ",err);
                return spritz.json(req,res,{error:"ECLTSK",description:"Error closing user task",detail:err},500);
            }

            return spritz.json(req,res,{ok:true, task: task.Name, id: task._id});
        });
    });

});

// Resume a task and set as current task
spritz.on('/services/resume', {auth: authCheck}, function(req,res){

    var
        user = req.authUser,
        taskName = req.args.t;

    // Validation
    if ( !user )
        return spritz.json(req,res,{error:"ENOAUTH",description:"User not authenticated"},500);

    // Get current task
    return bizTasks.getCurrentTask(user,function(err,ctask){
        if ( err ) {
            log.error("Error getting current user '"+user+"' task: ",err);
            return spritz.json(req,res,{error:"ENOTASK",description:"There is no current task assigned to this user and for current day"},200);
        }

        // Open it
        return bizTasks.openTask(user,ctask.TaskName,function(err,task){
            if ( err ) {
                log.error("Error closing user '"+user+"' task: ",err);
                return spritz.json(req,res,{error:"EOPTSK",description:"Error opening user task",detail:err},500);
            }

            return spritz.json(req,res,{ok:true, task: task.Name, id: task._id});
        });
    });

});


// Assets / static content handler
spritz.on(/^\/assets\//,function(req,res){
    return spritz.staticfile(req,res,"public/"+req.url,200);
});


// Homepage handler
spritz.on('/', {auth: authCheck}, function(req,res){

    // What date ?
    var
        today = new Date(),
        strDate = req.args['date'],
        binDate,
        total = 0,
        viewUser = (req.args['asuser'] ? req.args['asuser'] : req.authUser);

    if ( !strDate || !strDate.match(/^\d{4}\-\d{1,2}\-\d{1,2}/) )
        strDate = (parseInt(today.getYear()+1900)+"-"+parseInt(today.getMonth()+1)+"-"+today.getDate());
    binDate = datetime.fromString(strDate);

    if ( binDate > today )
        return spritz.json(req,res,{error:"Date on the future"},302,{location:'/'})
//      strDate = (parseInt(today.getYear()+1900)+"-"+parseInt(today.getMonth()+1)+"-"+today.getDate());

    // Get the existing task list
    return bizTasks.getUserDaylog(viewUser,binDate,function(err,rows){
        if ( err ) {
            log.error("Error getting user '"+viewUser+"' daylog tasks: ",err);
            return spritz.json(req,res,{error:"EGYDYL",description: "Error getting user daylog", details: err},500);
        }

        // Get top projects
        return bizTasks.getTopProjects(viewUser, 30, 10, function(err,topProjects){
            // Convert time to string and count the total time
            rows.forEach(function(row){
                total += row.Time;
                row.Time = minutesToStr(row.Time);
            });

            return spritz.template(req,res,'index.jst',{
                user:       req.authUser,
                viewUser:   viewUser,
                date:       strDate,
                todaysLog:  rows,
                total:      minutesToStr(total),
                users:      Object.keys(conf.auths).sort(),
                projects:   topProjects
            });
        });
    });

});

// Save handler
spritz.on('/save',{method:"POST", auth: authCheck},function(req,res){

    if ( !req.POSTjson || typeof req.POSTjson != "object" ) {
        console.log("No POSTjson or invalid POSTjson structure");
        return spritz.json(req,res,{error:"No POSTjson or invalid POSTjson structure"},400);
    }

    var
        date = req.POSTjson.date,
        rows = [];

    if ( date == null || !date.match(/^\d{4}\-\d{1,2}\-\d{1,2}$/) ) {
        var today = new Date();
        date = (parseInt(today.getYear()+1900)+"-"+parseInt(today.getMonth()+1)+"-"+today.getDate());
    }
    date = datetime.fromString(date);

    // Rows
    if ( !req.POSTjson.rows || !(req.POSTjson.rows instanceof Array) )
        return spritz.json(req,res,{error:"Now rows or invalid rows object"},400);

    // Check each row
    req.POSTjson.rows.forEach(function(row){
        if ( !row.Task || row.Task.toString().trim() == "" || !row.Time || strToMinutes(row.Time) == null )
            return;
        var
            storeRow = { Username: req.authUser, Date: date, Task: row.Task.toString(), Time: strToMinutes(row.Time) };
        if ( row.Notes && row.Notes.toString().trim() != "" )
            storeRow.Notes = row.Notes.toString();

        rows.push(storeRow);
    });

    // Update user daylog for the supplied date
    bizTasks.setUserDaylog(req.authUser,date,rows,function(err,stored){
        if ( err ) {
            log.error("Error setting user '"+req.authUser+"' daylog: ",err);
            return spritz.json(req,res,{error:"ESETUDL",description:"Error getting user daylog",details:err},500);
        }

        // Done
        return spritz.json(req,res,{ok:true,rows:stored.length},200);
    });

});

spritz.on(/^\/reports\/by\/project\/$/, {auth: authCheck}, function(req,res){

    var
        dateFrom = req.args.date,
        dateTo,
        viewUser = (req.args['asuser'] ? req.args['asuser'] : req.authUser),
        projectsByDay = {},
        tasksByDayProject = {},
        minutesByDayProject = {};

    // Parse date
    if ( dateFrom && dateFrom.match(/^\d{4}\-\d{1,2}\-\d{1,2}$/) ) {
        try {
            dateFrom = datetime.fromString(dateFrom.replace(/^(\d{4}[\/-]\d{1,2}).*$/, "$1/1"));
        }
        catch(ex){
            console.log("EXL", ex);
        }
    }
    else
        dateFrom = null;
    if ( !dateFrom ) {
        dateFrom = new Date();
        dateFrom.setDate(1);
        dateFrom = datetime.fromString(dateFrom.toJSON().substr(0, 10))
    }

    dateTo = new Date(dateFrom.getTime());
    dateTo.setMonth(dateTo.getMonth()+1);

    // Query the database
    return bizTasks.list({Username:viewUser,Date:{$gte:dateFrom,$lt:dateTo}},[['Date',1],['Task',1]],function(err,rows){

        // Count minutes by project
        var total = 0;
        rows.forEach(function(row){
            row.Date = datetime.fromString(row.Date);
            var day = ((row.Date.getDate()<10)?"0":"")+row.Date.getDate()+"/"+parseInt(row.Date.getMonth()+1);
            if ( !projectsByDay[day] )
                projectsByDay[day] = {};
            if ( !projectsByDay[day][row.Task] )
                projectsByDay[day][row.Task] = 0;

            if ( !tasksByDayProject[day] )
                tasksByDayProject[day] = {};
            if ( !tasksByDayProject[day][row.Task] )
                tasksByDayProject[day][row.Task] = [];

            projectsByDay[day][row.Task] += row.Time;
            tasksByDayProject[day][row.Task].push(row);
            total += row.Time;
        });

        // Make a list of every project with the corresponding time and percentage
        var days = [];
        Object.keys(projectsByDay).sort().forEach(function(day){
            var
                today        = {Day: day, Projects: [], Total: 0},
                excludedTime = 0;

            // Count number of hours for current day
            Object.keys(projectsByDay[day]).sort().forEach(function(project){
                today.Total += !_excludeFromReport(project) ? projectsByDay[day][project] : 0;
                if ( _excludeFromReport(project) )
                    excludedTime += projectsByDay[day][project];
            });
            // Add the projects
            Object.keys(projectsByDay[day]).sort().forEach(function(project){
                var
                    pct = !_excludeFromReport(project) ?
                        ((projectsByDay[day][project] * 100)/today.Total).toFixed(2)+" %" :
                        "N/A";
                if ( !req.args.grep || project.toString().indexOf(req.args.grep.toString()) > -1 )
                    today.Projects.push({Name: project, Time: minutesToStr(projectsByDay[day][project]), Percentage: pct, Tasks: tasksByDayProject[day][project]});
            });
            today.TotalTime = minutesToStr(today.Total);
            today.Projects.sort(function(a, b){
                if (a.Percentage == "N/A")
                    return 1;
                if (b.Percentage == "N/A")
                    return -1;
                if (parseFloat(a.Percentage) > parseFloat(b.Percentage))
                    return -1;
                if (parseFloat(b.Percentage) > parseFloat(a.Percentage))
                    return 1;
                return 0;
            });
            days.push(today);
        });

        return spritz.template(req, res, 'reports/by_project.jst', {
            user:       req.authUser,
            viewUser:   viewUser,
            dateFrom:   dateFrom,
            dateTo:     dateTo,
            date:       (parseInt(dateFrom.getYear()+1900)+"-"+(dateFrom.getMonth()+1)+"-"+dateFrom.getDate()),
            days:       days,
            total:      minutesToStr(total),
            users:      Object.keys(conf.auths).sort(),
            showNotes:  (req.args && req.args.showNotes == 'true')
        });
    });

});


// Useful functions

function _excludeFromReport(project) {
    return project.match(/Personal|Private/);
}

function minutesToStr(min) {
    var
        m = parseFloat(min),
        s = Math.round((m % 60)*60) % 60,
        h = parseInt(m / 60);

    if ( min == 0 )
        return '0m';

    m = parseInt(m % 60);
    return (((h > 0)?(h+"h "):"") + (((h > 0 && s > 0) || m > 0)?(m+"m "):"") + ((s > 0)?(s+"s"):"")).replace(/\s+$/,"");
}

function strToMinutes(str) {
    if ( str.match(/^(\s*\d+(?:\.\d+)?\s*[hms]){1,3}\s*$/i) ) {
        var min = 0;
        while ( str.match(/^\s*(\d+(?:\.\d+)?)\s*([hms])/) ) {
            var
                v = parseFloat(RegExp.$1) * ((RegExp.$2 == "h") ? 60 : (RegExp.$2 == "s") ? 1/60 : 1);
            min += v;
            str = str.replace(/^\s*([\d\.]+)\s*([hms])/i,"");
        }
        return min;
    }
    else if ( str.match(/^(\d+(?:\.\d+)?)$/) ) {
        return parseFloat(RegExp.$1);
    }
    return null;
}


/*
 * DAILY REPORT
 */

var
    sending = false,
    lastReport;


function maybeSendReport(){

//    if ( sending )
        return;

    var
        handler     = function(){ sending = false; },
        now         = new Date(),
        today       = new Date(),
        yesterday   = new Date();

    // FIXME: remove the next 2 lines
//  today.setDate(today.getDate()-3);
//  yesterday.setDate(yesterday.getDate()-3);
    yesterday.setDate(yesterday.getDate()-1);

    var
        strToday    = today.getFullYear()+"-"+parseInt(today.getMonth()+1)+"-"+today.getDate(),
        isWeekend   = (yesterday.getDay() == 6) || (yesterday.getDay() == 0);

    if ( now.getHours() != 1 || now.getMinutes() != 1 )
        return;
    if ( lastReport && strToday == lastReport.Date )
        return handler(null,false);

    sending = true;

    // Get the reports for today
    [today,yesterday].forEach(function(d){
        d.setHours(0);
        d.setMinutes(0);
        d.setSeconds(0);
        d.setMilliseconds(0);
    });

    // Query the database and hash data by user and count the time
    var
        rowsByUser      = {},
        totalByUser     = {},
        statusByUser    = {};

    console.log("Getting rows for yesterday's ("+yesterday.toString()+") report...");
    return bizTasks.list({Date:{$gte:yesterday,$lt:today}},[['Username',1],['Date',1],['Task',1]],function(err,rows){
        if ( err ) {
            console.log("Error getting rows for today's report: ",err);
            return handler(err,null);
        }

        rows.forEach(function(row){
            if ( !row.Username )
                return;
            if ( !rowsByUser[row.Username] )
                rowsByUser[row.Username] = [];
            rowsByUser[row.Username].push(row);
            if ( totalByUser[row.Username] == null )
                totalByUser[row.Username] = 0;
            totalByUser[row.Username] += row.Time;
        });
        for ( var user in totalByUser ) {
            statusByUser[user]  = (totalByUser[user] < 300) ? 'incomplete' : 'ok';
            totalByUser[user]   = minutesToStr(totalByUser[user]);
        }

        // Week days, check all the users without rows and mark them as 'empty'
        if ( !isWeekend ) {
            for ( var user in reportUsers ) {
                if ( totalByUser[user] == null ) {
                    totalByUser[user]   = minutesToStr(0);
                    statusByUser[user]  = 'empty';
                }
            }
        }
        // If nobody was reporting nothing on the weekend, nevermind!
        else if ( Object.keys(totalByUser).length == 0 ) {
            console.log("It's weekend and nobody wrote nothing... just forget!");
            return handler(null,false);
        }

        // Send the report
        var
            strYesterday = yesterday.getFullYear()+"-"+parseInt(yesterday.getMonth()+1)+"-"+yesterday.getDate(),
            subject = "Report de "+strYesterday,
            text = "Report diário de "+strYesterday+"\n\n";

        // Fix rows for printing
        rows.forEach(function(row){
            if ( row.Task.match(/^(.*?): +(.+?)$/) || row.Task.match(/^(.*?)\s+\-\s+(.+?)$/) ) {
                row.Task = RegExp.$1;
                row.Notes = RegExp.$2 + (row.Notes?(" - "+(row.Notes||"")):"");
            }
        });

        // Mount the text
        ['empty', 'incomplete', 'ok'].forEach(function(status){
            for ( var user in totalByUser ) {
                if ( statusByUser[user] != status )
                    continue;
                if ( status == "empty" )
                    text += "  "+conf.names[user]+": Não preencheu o report!!\n";
                else {
                    text += "\n  "+conf.names[user]+":\n";
                    // Group by task
                    var byTask = {};
                    rowsByUser[user].forEach(function(row){
                        if ( !byTask[row.Task] )
                            byTask[row.Task] = [row];
                        else
                            byTask[row.Task].push(row);
                    });
                    for ( var task in byTask ) {
                        if ( byTask[task].length == 1 ) {
                            var row = byTask[task][0];
                            text += "    "+task+" ("+minutesToStr(row.Time)+")\n";
                        }
                        else {
                            text += "    "+task+":\n";
                            byTask[task].forEach(function(row){
                                text += "      - "+(row.Notes||"").replace(/[\r\n]/g,"; ").replace(/; $/,"")+" ("+minutesToStr(row.Time)+")\n";
                            });
                        }
                    }
                    text += "  TOTAL: "+totalByUser[user];
                    text += "\n";
                }
            }
            text += "\n";
        });

//      console.log("Subject: ",subject);
//      console.log("Text:    ",text);

        // Send by mail
        return sendmail(
            {
                from:       'david-report@prozone.org',
                to:         ['david-report@prozone.org'],
                subject:    subject,
                content:    text
            },
            function(err, reply) {
                if ( err ) {
                    console.log("Error sending report e-mail: ",err);
                    return handler(err,null);
                }
                console.log("Report successfully sent: ",reply);

                // Register report
                lastReport = { Date: strToday, Sent: new Date(), Subject: subject, Text: text };
                bizReports.report(lastReport,function(err,ok){
                    if ( err ) {
                        log.error("Error registering report: ",err);
                        return handler(err,null);
                    }
                });
            }
        );

    });

}

function sendmail(opts,handler) {

    var
        tos = (opts.to instanceof Array) ? opts.to : [opts.to];

    return async.mapSeries(tos,
        function(mail,next){
            opts.to = mail;
            return _sendmail(opts,next);
        },
        function(err,sendRes){
            if ( err ) {
                console.log("Error sending e-mails: ",err);
                return handler(err,null);
            }
            opts.to = tos;
            return handler(null,sendRes);
        }
    );

}

function _sendmail(opts,handler) {

    var
        con = new SMTPC({
            host:   "smtp.xx",
            secure: false,
        });

    console.log("Sending mail to: ",opts.to);
    con.on('error',function(err){handler(err,null);});
    con.connect(function(err){
        if ( err ) {
            console.log("Error connecting to SMTP server: ",err);
            return handler(err,null);
        }
        con.send(
            {
                from:   opts.from,
                to:     opts.to
            },
            "Subject: "+(opts.subject||"")+"\r\nFrom: "+opts.from+"\r\n\r\n"+(opts.content||""),
            function(err,res){
                if ( err ) {
                    console.log("Error sending mail via SMTP: ",err);
                    return handler(err,null);
                }

                // Quit before anything else
                con.quit();

                return handler(null,res);
            }
        );

    });

}

// What time did we send the last report ?
bizReports.getLastReport(function(err,report){
    if ( err ) {
        console.log("Error getting last report: ",err);
        throw err;
    }

    lastReport = report;
    if ( lastReport )
        console.log("Got last report: ",lastReport.Date);
    // Periodically check if can send report
    setInterval(maybeSendReport,60000);
    maybeSendReport();
});
