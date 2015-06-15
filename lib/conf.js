"use strict";

var
	object		= require('./util/object'),
	lconf		= require('../conf/core');


// GET
exports.get = function(path) {

	return object.getPropertyValue(lconf,path);

};
