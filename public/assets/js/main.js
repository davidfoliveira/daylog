// Instantiate Ink objects
var modalWin;
Ink.requireModules(['Ink.Dom.Selector_1','Ink.UI.DatePicker_1'],function( Selector, DatePicker ){
	var datePickerObj = new DatePicker('#dayPicker',{
		onSetDate:function(dp){
			var
				now = dp.getDate(),
				strDate = (parseInt(now.getYear()+1900)+"-"+parseInt(now.getMonth()+1)+"-"+now.getDate());
			if ( strDate != $("#dayPicker").attr('data-prev') ) {
				var
					qs = parseQueryString();
				qs['date'] = strDate;
				location.href = "?"+stringifyQueryString(qs);
			}
		}
	});
});

Ink.requireModules( ['Ink.Dom.Selector_1','Ink.UI.Modal_1'], function( Selector, Modal ){
	modalWin = new Modal(Ink.s('#myModal'));
});


/*
 * Some cool code here
 */

var
	USERNAME = $("body").attr("data-user");

// Is the interface locked ?
var locked = ($("body.locked").length > 0);

// Click on the project cell
if ( !locked ) {
	$(".log table tbody td.project").click(function(ev){
		ev.stopPropagation();

		// Already has the editable element? Forget!
		if ( $(this).children("input").length > 0 )
			return;

		makeEditable($(this),'project');
		$(this).append($("<textarea class=\"text textarea editable notes\" id=\"notes\"></textarea>"));
		$("#notes").val($(this).attr("data-notes"));
		$("#notes").change(function(){calculateNoteTimes($(this));});
	});

	// Click on the time cell
	$(".log table tbody td.time").click(function(ev){
		ev.stopPropagation();

		// Already has the editable element? Forget!
		if ( $(this).children("input").length > 0 )
			return;

		makeEditable($(this),"time");
	});

	// Click on remove button
	$(".log table tr td.tools .del").click(function(ev){
		ev.stopPropagation();

		// He changed something
		userMadeChanges();

		$(this).parent().parent().remove();
		calculateTimes();
	});

	// New event button
	$("#newevent").click(function(ev){
		ev.preventDefault();
		newEvent("Nova tarefa","1h");
		setTimeout(function(){
			makeEditable($(".log table tr:last-child td.project"),"project");
			$(".log table tr:last-child td.project").append($("<textarea class=\"text textarea editable notes\" id=\"notes\"></textarea>"));
			$("#notes").change(function(){calculateNoteTimes($(this));});
		},100);
	});

	// Open modal window for inserting events on text
	$("#newtxtevents").click(function(ev){
		modalWin.open();
		$("textarea.code").focus();
	});

	// Save button
	$("#save").click(function(){

		// Hide editable element
		hideEditable();

		// Build an object with all the data
		var
			rows = [];

		$(".log table tr").each(function(idx,trow){
			// Get each field
			var
				task =  ($(trow).children("td.project").text() || "").trim(),
				time =  ($(trow).children("td.time").text() || "0").trim(),
				notes = ($(trow).children("td.project").attr("data-notes") || "").trim();

			if ( !task || !time )
				return;

			rows.push({ Task: task, Time: time, Notes: notes });
		});

		// Save
		$.ajax({
			type: "POST",
			url:  location.href.match(/\/daylog\//) ? location.href.replace(/\/daylog\//,"/daylog/save") : "/save",
			data: JSON.stringify({date: $("#dayPicker").val(), rows: rows}),
			dataType: "json",
			contentType: "application/json; charset=utf-8",
			success: function(answer){
				if ( !answer.ok ) {
					console.log("Error storing data: ",answer);
					return;
				}
				changed = false;

//				console.log("Data stored: ",answer);
				var
					userTitle = "Senhor";

				$(".log").after($('<div class="ink-alert basic fade success" role="alert" id="alert"><button class="ink-dismiss">&times;</button><p><b>'+userTitle+':</b> Data sucessfully saved.</p></div>'));
				setTimeout(function(){
					$("#alert").remove();
				},1500);
			}
		});

	});

	// Modal add button
	$("#myModal .modal-footer button").click(function(){
		var
			txt = $(".ink-form .code").val(),
			lines = txt.split(/[\r\n]/);

		for ( var x = 0 ; x < lines.length ; x++ ) {
			var line = lines[x];
			if ( line.match(/^\s*$/) )
				continue;
			if ( line.match(/^(.*?)\s{4,}([\d\.hms]+)(?:\s{4,}(.*))?\s*$/) ) {
				var
					name = RegExp.$1,
					details = RegExp.$3 || "",
					time = sanitizeTimeString(RegExp.$2);

				if ( time == null ) {
					alert("Error parsing time string. Line #"+x);
					return;
				}
				newEvent(name,time,details);
			}
			else if ( line.match(/^\s*(.*?)\s+((?:\s*[:@\+]\S+)+)\s*$/) ) {
				var
					name,
					details = RegExp.$1,
					tags = RegExp.$2,
					time,
					projTags = {
						sbbo:  "SAPO Banca BO",
						sbapi: "SAPO Banca API",
						sdesp: "SAPO Desporto",
						sn:    "SAPO Notícias",
						sb:    "SAPO Banca",
						sbIOS: "Apps Banca"
					};

				if ( tags.match(/\s*:((?:\s*\d+[hms])+)\s*/) )
					time = sanitizeTimeString(RegExp.$1);
				// Por causa do Andre estender a roupa
				if ( USERNAME == "andrefs" && !tags.match(/\+sapo/) )
					continue;
				tags = tags.replace(/:\S+\s*/g,"").replace(/\+sapo\s*/," ").replace(/^\s+/,"").replace(/\s+$/,"").replace(/\s{2,}/," ").replace(/\s+.*/,"");
				name = projTags[tags.replace(/^\+/,"")] || tags;
				if ( !name ) {
					name = details;
					details = "";
				}

				if ( time == null ) {
					alert("Error parsing time string. Line #"+x);
					return;
				}
				newEvent(name,time,details);
			}
			else {
				alert("Syntax error. Line #"+x);
				return;
			}
		}

		modalWin.dismiss();
		modalWin.destroy();

	});

	// Click on projects, on the projects list box
	$(".projects ul li").click(function(ev){
		ev.preventDefault();
		newEvent($(this).text(),"1h");
		setTimeout(function(){
			makeEditable($(".log table tr:last-child td.time"),"time");
//			$(this).append($("<textarea class=\"text textarea editable notes\" id=\"notes\"></textarea>"));
		},100);
	});
}

// User select
$(".usersel").change(function(ev){
	var
		qs = parseQueryString();
	qs['asuser'] = $(".usersel").val();
	location.href = "?"+stringifyQueryString(qs);
});


// Document click (out)
$("html").click(function(){
	hideEditable();
});

// Key binding
$(document).keydown(function(e) {
	// Tab
	if (e.keyCode == 9) {
		e.preventDefault();
		if ( $("td.project #editable").length > 0 )
			makeEditable($("td.project #editable").parent().parent().children(".time"),"time");
		else
			hideEditable();
	}
});
$(document).keyup(function(e) {
	// Escape
	if (e.keyCode == 27) {
		e.preventDefault();
		hideEditable(true);
	}
});



// Create a new event
var newEvent = function(name,time,notes){

	$(".log table").append($('<tr><td class="project">'+name+'</td><td class="time">'+time+'</td><td class="tools"><button class="del fa fa-trash-o"></button></td></tr>'));
	$(".log table tr:last-child .project").attr("data-notes",notes);

	if ( notes )
		$(".log table tr:last-child .project").attr("data-notes",notes);

	$(".log table tr:last-child td.project").click(function(ev){
	        ev.stopPropagation();

	        // Already has the editable element? Forget!
	        if ( $(this).children("input").length > 0 )
	                return;

	        makeEditable($(this),"project");
	        $(this).append($("<textarea class=\"text textarea editable notes\" id=\"notes\"></textarea>"));
	        $("#notes").val($(this).attr("data-notes"));
			$("#notes").change(function(){calculateNoteTimes($(this));});

	});
	$(".log table tr:last-child td.time").click(function(ev){
	        ev.stopPropagation();

	        // Already has the editable element? Forget!
	        if ( $(this).children("input").length > 0 )
	                return;

	        makeEditable($(this),"time");
	});
	$(".log table tr:last-child td.tools .del").click(function(ev){
	        ev.stopPropagation();
		$(this).parent().parent().remove();
		setTimeout(function(){
			calculateTimes();
		},100);
	});

	// He changed something
	userMadeChanges();

	setTimeout(function(){
		calculateTimes();
	}, 100);

};


// Editable stuff
var onFinishEditing = {
	project: function(val){
		// Set the notes attribute
		$("#editable").parent().attr("data-notes",$("#notes").val());

		// He changed something
		userMadeChanges();

		return true;
	},
	time: function(val){
		var
			pval = sanitizeTimeString(val);

		if ( pval == null ) {
			alert("Invalid value: '"+val+"'");
			return false;
		}

		// He changed something
		userMadeChanges();

		// Calculate total time
		setTimeout(function(){
			calculateTimes()
		},100);

		return pval;
	}
};


function parseQueryString() {
	var
		query = window.location.search.substring(1),
		vars = query.split('&');
		o = {};
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split('=');
		o[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
	}
	return o;
}

function stringifyQueryString(obj) {
	var
		str = [];
	for(var p in obj) {
		if (obj.hasOwnProperty(p))
			str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
	}
	return str.join("&");
}

// Parse a time string
var parseTimeString = function(val) {

	val = val.replace(/^[\r\n\s]+|[\r\n\s]+$/g,"");
	if ( val.match(/^(\s*\d+(?:\.\d+)?\s*[hms]){1,3}\s*$/i) ) {
		var min = 0;
		while ( val.match(/^\s*(\d+(?:\.\d+)?)\s*([hms])/) ) {
			var
				v = parseFloat(RegExp.$1) * ((RegExp.$2 == "h") ? 60 : (RegExp.$2 == "s") ? 1/60 : 1);
			min += v;
			val = val.replace(/^\s*([\d\.]+)\s*([hms])/i,"");
		}
		return min;
	}
	else if ( val.match(/^(\d+(?:\.\d+)?)$/) ) {
		return parseFloat(val);
	}

	return null;

};

// Convert a number of minutes into a time string
var minutesToTimeString = function(val) {

	if ( val == null )
		return null;

	var
		m = parseFloat(val),
		s = Math.round((m % 60)*60) % 60,
		h = parseInt(m / 60);

	m = parseInt(m % 60);
	str = ((h > 0)?(h+"h "):"") + (((h > 0 && s > 0) || m > 0)?(m+"m "):"") + ((s > 0)?(s+"s "):"");
	str = str.substr(0,str.length-1);
	return str;

};
window.minutesToTimeString = minutesToTimeString;


// Sanitize a time string
var sanitizeTimeString = function(val) {
	return minutesToTimeString(parseTimeString(val));
};



// Make the project name editable
var makeEditable = function(el,name){
	hideEditable();

	// Create the editable element
	var txt = $(el).text();
	$(el).attr("data-prevval",txt);
	$(el).text('');
	$(el).append($('<input type="text" class="editable'+(name?(' '+name):+'')+"\""+(name?(' data-field="'+name+'"'):'')+'\" id="editable">'));
	$('#editable').val(txt);
	$('#editable').keypress(function(e){
		if(e.which == 13)
			hideEditable();
	});
	$('#editable').focus();

};

// Remove the edition box
var hideEditable = function(ignore) {
	// Editable exists? Remove it!
	if ( $("#editable").length > 0 ) {
		if ( !ignore ) {
			var
				val = $("#editable").val(),
				keepGoing = true;

			// Check the handler on onFinishEdition for this field
			if ( onFinishEditing && $("#editable").attr("data-field") && typeof onFinishEditing[$("#editable").attr("data-field")] == "function" )
				keepGoing = onFinishEditing[$("#editable").attr("data-field")](val);

			if ( typeof keepGoing != "boolean" )
				setEditableValue(keepGoing);
			else if ( keepGoing )
				setEditableValue($("#editable").val());
//			else
//				setEditableValue($("#editable").parent().attr("data-prevval"));
		}
		else {
			setEditableValue($("#editable").parent().attr("data-prevval"));
		}
	}
};

// Set editable value
var setEditableValue = function(val) {

	var
		cel = $("#editable").parent();

	cel.attr("data-val",val);
	cel.empty();
	cel.text(val);

};

// Calculate times based on hour:minute on the notes
var calculateNoteTimes = function(el){
	// Count minutes mentioned on the value
	var
		val = el.val(),
		minutes = 0,
		timeIntervals = [];

	val.replace(/^\s*\(?\s*(\d{1,2}):(\d{1,2})\s+(?:[aà]s|\-)\s+(\d{1,2}):(\d{1,2})\s*\)?/gm,function(all,startHour,startMin,endHour,endMin){
		var
			startDate = new Date(),
			endDate = new Date();
		startDate.setHours(parseInt(startHour));
		startDate.setMinutes(parseInt(startMin));
		startDate.setSeconds(0);
		endDate.setHours(parseInt(endHour));
		endDate.setMinutes(parseInt(endMin));
		endDate.setSeconds(0);
		if ( endDate < startDate ) {
			var tmp = endDate;
			endDate = startDate;
			startDate = tmp;
		}
		minutes += (endDate - startDate) / 60000;
		timeIntervals = { start: startDate, end: endDate };
		return "";
	});
	if ( minutes > 0 ) {
		el.closest("tr").children(".time").html(minutesToTimeString(minutes));
		calculateTimes();
	}

	setTimeout(function(){
		rebuildTimeChart();
	},200);

	return timeIntervals;
}

// Rebuild time chart
function rebuildTimeChart() {

	var
		timeIntervals = [];

	// Parse all notes and get all the time intervals
	$(".log > table td.project").each(function(idx,taskCel){
		var
			task = $(taskCel),
			val  = task.attr("data-notes");

		val.replace(/^\s*\(?\s*(\d{1,2}):(\d{1,2})\s+(?:[aà]s|\-)\s+(\d{1,2}):(\d{1,2})\s*\)?/gm,function(all,startHour,startMin,endHour,endMin){
			var
				startDate = new Date(),
				endDate = new Date();
			startDate.setHours(parseInt(startHour));
			startDate.setMinutes(parseInt(startMin));
			startDate.setSeconds(0);
			endDate.setHours(parseInt(endHour));
			endDate.setMinutes(parseInt(endMin));
			endDate.setSeconds(0);
			if ( endDate < startDate ) {
				var tmp = endDate;
				endDate = startDate;
	                        startDate = tmp;
	                }
//	                minutes += (endDate - startDate) / 60000;
			color = val.match(/Private|Personal/) ? '#EAA' : task.text().match(/Break/i) ? '#AEA' : '#0C0';
	                timeIntervals.push({ start: startDate, end: endDate, color: color, title: ((endDate - startDate) / 60000)+' minutes' });
	                return "";
	        });
	});

	$("#timechart").html("");
        if ( typeof(ZTimeChart) != "undefined" ) {
		new ZTimeChart('timechart',timeIntervals,{
			showIntervals: true,
			dayStart: function(intervals){
				var nineoclock = new Date();
				nineoclock.setHours(8);
				nineoclock.setMinutes(0);
				nineoclock.setSeconds(0);
				nineoclock.setMilliseconds(0);
				return (intervals[0] && intervals[0].start < nineoclock) ? intervals[0].start : nineoclock;
			},
			dayEnd: function(intervals){
				var twentyoclock = new Date();
				twentyoclock.setHours(21);
				twentyoclock.setMinutes(0);
				twentyoclock.setSeconds(0);
				twentyoclock.setMilliseconds(0);
				return (intervals[intervals.length-1] && intervals[intervals.length-1].end > twentyoclock) ? intervals[intervals.length-1].end : twentyoclock;
			},
//			dayStartMs: 28800000,
			adaptableDayStart: true,
//			daySizeMs:  43200000,
			titleGenerator: function(el,pos,msDim,opts){
				var
					title = "",
					classDescr = { interval: 'por justificar', overlap: 'sobreposto', slot: '' };

				if ( el )
					title = ((el.start.getHours()>9)?el.start.getHours():"0"+el.start.getHours())+":"+
						((el.start.getMinutes()>9)?el.start.getMinutes():"0"+el.start.getMinutes())+" - "+
						((el.end.getHours()>9)?el.end.getHours():"0"+el.end.getHours())+":"+
						((el.end.getMinutes()>9)?el.end.getMinutes():"0"+el.end.getMinutes());
				title += " ("+window.minutesToTimeString(msDim/1000/60)+') '+classDescr[opts.className];
				return title;
			}
		});
	}

}

// Calculate total times
function calculateTimes(){

	var
		total = 0;

	$(".log table tbody tr").each(function(idx,lineEl){
		var taskName = $(lineEl).find(".project").text();
		if (taskName.match(/(Personal|Private)/))
			return;
		el = $($(lineEl).find(".time"));
		var time = parseTimeString($(el).text());
		total += time;
	});
	$(".totals .time").html(minutesToTimeString(total));
	$(".totals .time").addClass("changed");
	setTimeout(function(){
		$(".totals .time").removeClass("changed");
	},1000);

};

function updateLineColours() {

	$(".log table tbody tr").each(function(idx,lineEl){
		var taskName = $(lineEl).find(".project").text();
		$(lineEl).removeClass(function (index, className) {
			return (className.match(/(^|\s)tag_\S+/g) || []).join(' ');
		});
		if (taskName.match(/(Personal|Private)/))
			$(lineEl).addClass("tag_personal");
		else if (taskName.match(/(Break)/))
			$(lineEl).addClass("tag_break");
	});

}


// User make some changes
var changed = false;
var userMadeChanges = function(){

	if ( changed )
		return;
	changed = true;

	updateLineColours();

	window.onbeforeunload = function (e) {
		return changed ? 'Sir: you have made some changes on your daily log, are you sure about geting away from here?' : null;
	};

};


// Generate time chart
calculateTimes()
updateLineColours();
rebuildTimeChart();
