if ( !window.$_ ) {
	// The Ninja toolkit 2.1
	window.$_ = {
		forEach:  function(a,callback){if(a instanceof Array){for(var x=0;x<a.length;x++)callback(a[x],x);}else{for(var p in a){if(a.hasOwnProperty(p))callback(p,a[p]);}}},
		merge:    function(){var o={};$_.forEach(Array.prototype.slice.call(arguments,0),function(a){if(a){$_.forEach(a,function(p,v){o[p]=v;});}});return o;},
		keys:	  function(o){var kl=[];$_.forEach(o,function(k){kl.push(k);});return kl;},
		diff:     function(d,c){var e=function(b,a){return(b===null||typeof b!=="object")&&(a===null||typeof a!=="object")&&b!==a};var f={};$_.forEach(d,function(b,a){if(e(a,c[b])){f[b]=c[b]}});$_.forEach(c,function(b,a){if(e(a,d[b])){f[b]=c[b]}});return f},
		ajax:     function(url,opts,callback){if(typeof opts == "function"){callback=opts;opts={};}return new InkAjax(url,$_.merge({method:"GET",onSuccess: function(xhr){callback(null,xhr.responseJSON||xhr.responseXML||xhr.responseText);},onException:function(err){callback(err,null);},onTimeout:function(){callback(new Error("Timeout"),null);},onFailure:function(err){callback(err);}},opts));},
		series:   function(fns,callback){var _fns=fns.slice(),_r=[],_next=function(){if(!_fns.length)return callback(null,_r);_fns.shift()(function(err,val){if(err)return callback(err,_r);_r.push(val);return setTimeout(_next,0);});};return _next();},
		clone:    function clone(o){if(null==o||"object"!=typeof o) return o;var cp=o.constructor();for(var attr in o)if(o.hasOwnProperty(attr))cp[attr]=o[attr];return cp;},
		log:      function(level,args){var a=Array.prototype.slice.call(arguments);a[0]=new Date().toISOString().substr(11,8)+" ["+level+"] "+((level<10)?" ":"");if(($_._LOGLEVEL==null || level<=$_._LOGLEVEL) && typeof(console)!="undefined"){console.log.apply(console,a);}},
		build:    function(o){var wObj=false,dObjs=[];if(!(o instanceof Array)){o=[o];wObj=true;}$_.forEach(o,function(el){dObjs.push($_.buildObj(el));});return wObj?dObjs[0]:dObjs;},
		buildObj: function(o){var dom=document.createElement(o.tagName||"DIV");$_.set(dom,o);return dom;},
		element:  function(e){return (typeof e=="string")?document.getElementById(e):e;},
		set:	  function(dom,o){ for(var p in o){if(typeof(o[p])!="undefined"&&o[p]!=null){if(!p.match(/^_/)){if(p=="textContent")dom.textContent = o[p];else if(p=="childs"&&o[p] instanceof Array){$_.forEach(o[p],function(c){dom.appendChild(c.nodeType==null?$_.build(c):c);});}else if(p.match(/^on(\w+)$/)){$_.observe(dom,RegExp.$1.toLowerCase(),o[p]);}else if(p!="tagName"){$_._set(dom,p,o[p]);}}}}},
		_set:	  function(o,p,v){if(typeof(v)=="object"&&v instanceof Array){if(!(o[p] instanceof Array))o[p]=[];$_.forEach(v,function(av){p[p].push($_.clone(av));});}else if(typeof(v)=="object"){if(typeof(o[p])!="object")o[p]={};for(var op in v){if(p=="style")o[p].setProperty(op,v[op]);else $_._set(o[p],op,v[op]);}}else if(p.match(/\-/)&&o.tagName!=null)o.setAttribute(p,v);else o[p]=v;},
		observe:  function(el,ev,cb){var _el=$_.element(el);if(_el){if(_el.addEventListener)_el.addEventListener(ev,cb,false);else _el.attachEvent('on'+ev,cb);}},
		forget:   function(el,ev,cb){var _el=$_.element(el);if(_el){if(_el.removeEventListener)_el.removeEventListener(ev,cb,false);else _el.detachEvent('on'+ev,cb);}}
	};
}
	
(function(){

	var parseTime = function(str) {
		var
			now = new Date(),
			h,
			m,
			s,
			ms;

		// The input is already a date object but... we have to make sure that we are working on the current day
		if ( str instanceof Date ) {
			now.setHours(str.getHours());
			now.setMinutes(str.getMinutes());
			now.setSeconds(str.getSeconds());
			now.setMilliseconds(str.getMilliseconds());
			return now;
		}

		// Parse the string time
		if ( !str.match(/^(\d{1,2}):(\d{1,2})(?:(\d{1,2})(?:\.(\d+))?)?$/) )
			return null;

		h = parseInt(RegExp.$1);
		m = parseInt(RegExp.$2);
		s = parseInt(RegExp.$3||"0");
		ms = parseInt(RegExp.$4||"0");
		if ( h > 23 || m > 59 || s > 59 || ms > 99 )
			return null;

		now.setHours(h);
		now.setMinutes(m);
		now.setSeconds(s);
		now.setMilliseconds(ms);
		return now;
	};

	var today = function() {
		var d = new Date();
		d.setHours(0);
		d.setMinutes(0);
		d.setSeconds(0);
		d.setMilliseconds(0);
		return d;
	};

	var _buildDOMElement = function(pos,msDim,opts,el) {
		var
			self = this,
			msPos = pos - today();

		if ( !opts )
			opts = {};

		if ( self.opts.dayStartMs )
			msPos -= self.opts.dayStartMs;

		return {
			tagName: "LI",
			className: (opts.className || "slot"),
			title: self.opts.titleGenerator ? self.opts.titleGenerator(el,pos,msDim,opts) : null,
			style: $_.merge({
				width:		(100 * msDim / self.opts.daySizeMs)+'%',
				left:		(100 * msPos / self.opts.daySizeMs)+'%',
				background:	(opts.className == "slot") ? (this.opts.defaultColor || '#000') : null
			},opts.style||{})
		};
	};

	var _ZTimeChart = function(output,data,opts){
		var self = this;
		self._o = document.getElementById(output);
		self.buildDOMElement = _buildDOMElement;
		if ( !self._o )
			return false;
		if ( !opts )
			opts = {};
		self.opts = opts;

		// Build default options
		if ( !opts.daySizeMs )
			opts.daySizeMs = 86400000;
		if ( !opts.defaultColor )
			opts.defaultColor = '#000';
		if ( opts.showIntervals == null )
			opts.showIntervals = false;
		if ( opts.showOverlap == null )
			opts.showOverlap = true;

		// Compile elements data
		data = data.sort(function(a,b){return a.start-b.start});
		$_.forEach(data,function(el){
			el.id    = idx++;
			el.start = parseTime(el.start);
			el.end   = parseTime(el.end);
		});

		// Build the dayStart option
		if ( typeof opts.dayStart == "function" && opts.dayStartMs == null ) {
			opts.dayStartMs = opts.dayStart(data) - today();
		}
		else if ( opts.dayStartMs == null )
			opts.dayStartMs = 0;

		// Build the elements DOM
		var
			els = [],
			last,
			idx = 1;

		$_.forEach(data.sort(function(a,b){return a.start-b.start}),function(el){

			if ( last && Math.abs(last.end-el.start) > 0 ) {
				diffFromLast = el.start - last.end;
				if ( diffFromLast > 0 && opts.showIntervals )
					els.push(self.buildDOMElement(last.end,Math.abs(el.start-last.end),{className: "interval"},{start:last.end,end:el.start}));
				else if ( diffFromLast < 0 && opts.showOverlap )
					els.push(self.buildDOMElement(el.start,Math.abs(diffFromLast),{className: "overlap",style:{"z-index":99}},{start:el.start,end:last.end}));
			}

			els.push(self.buildDOMElement(el.start,Math.abs(el.end-el.start),{className:"slot",style:{background:el.color}},el));
			last = el;
		});

		// Add the elements to DOM
		self._o.appendChild($_.build({tagName:"OL",className:"ztimechart",childs:els}));
	};
	window.ZTimeChart = _ZTimeChart;

})();

