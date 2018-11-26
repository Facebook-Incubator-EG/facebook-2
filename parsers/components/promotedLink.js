#!/usr/bin/env node
var _ = require('lodash');
var cheerio = require('cheerio');
var moment = require('moment');
var debug = require('debug')('promotedLink');
var parse = require('./lib/parse');
var entities = require('entities');
var nconf = require('nconf'); 

var postcount = 0;
var errorcount = 0;

nconf.set("PARSER_PROMOTEDLINK_VERSION", "201612.01");

function getPromotedTitle(snippet) {

	var link;
	var link_type;

	var e_threshold;
	var e_linkcontainer;
	var e_ptr;

    var found = false;

	postcount ++;

    var $ = cheerio.load(snippet.html);

    // posted links
    e_threshold = $('div.userContentWrapper');
    e_linkcontainer = e_threshold.find("div.clearfix");
    e_ptr = e_linkcontainer.find("a.profileLink").parent().next();

    if (e_ptr.attr("href") != undefined) {
        found = true;
        link_type = "link";
    }

	// videos, posts		
	if (!found) {	
		e_threshold = $('div.userContent');
		e_linkcontainer = e_threshold.next().find("div.clearfix");
		if (e_linkcontainer.find("a")[0] !== undefined) {
			e_ptr = e_linkcontainer.find("a").first();
			found = true;
            link_type = "video";
		}
	}

    // page link
    if (!found) {
		e_threshold = $('div.userContentWrapper');
		e_linkcontainer = e_threshold.find("div.clearfix");

		if (e_linkcontainer.find(":first-child").is("a")) {
			e_ptr = e_linkcontainer.find(":first-child");
			found = true;
            link_type = "page";
		}
	}

	// if we have a href element with content in e_ptr then we have a link
	if (found && e_ptr.attr("href") !== "#") {
		link = e_ptr.attr("href");
	} 

	if (!link) {
		debug(" -- Error %d posts %d | %s#", errorcount, postcount, snippet.id );
		errorcount++;
		return { 'promotedLink': false };
    };

    debug("! %d\t%d %s (%s)", errorcount, postcount, link, link_type);
    return {
         "postLink": link,
         "linkType": link_type,
         'promotedLink': true
    };

};

return parse.please({
    'name': 'promotedLink', /* this name is the same in parsers-key */
    'requirements': {'type': 'promoted'},
    'implementation': getPromotedTitle,
    'since': "2016-09-13",
    'until': moment().toISOString(),
});

