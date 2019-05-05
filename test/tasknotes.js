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

console.log(formatTaskNotes(parseTaskNotes('17:02 - 18:01\n18:10 - 18:11: Cenas')));
