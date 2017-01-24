#!/usr/bin/env nodejs
var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('debug')('hourly-usage');
var moment = require('moment');
var nconf = require('nconf');

var mongo = require('../lib/mongo');
var timutils = require('../lib/timeutils');

var cfgFile = "config/settings.json";
nconf.argv().env().file({ file: cfgFile });

/*
 * when: `ISO date`
 * htmls: `Int`      | number of htmls
 * impressions: `Int`| guess what..
 * accesses: `Int`   | accesses, page views
 * active: `Int`     | timelines, count users + countries
 * new: `Int`        | supporters, `keyTime`
 */

var timeFilter = timutils.doFilter(
        nconf.get('HOURSAFTER'), 
        nconf.get('DAYSAGO'), 
        nconf.get('HOURSAGO'), 1, 'h'
    );
debug("Executing timewindow: %s", timutils.prettify(timeFilter));

function getFromAccesses() {
    var filter = { when: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    var group = { _id: { ccode: "$ccode"},
                  amount: { $sum: 1} };
    return mongo
      .aggregate(nconf.get('schema').accesses, filter, group)
      .reduce(function(memo, c) {
          memo.visits += c.amount;
          var ccode = c["_id"]["ccode"];
          if(ccode && _.size(ccode ) !== 2)
              debug("unexpected `ccode` %s", ccode);
          if(!ccode) ccode = "redacted";
          memo[ccode] = c.amount;
          return memo;
      }, { visits: 0 });
}

function getNewTimelines() {
    var filter = { startTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    var group = { _id: { geoip: "$geoip" },
                  amount: { $sum: 1} };
    return mongo
      .aggregate(nconf.get('schema').timelines, filter, group)
      .reduce(function(memo, c) {
          memo.timelines += c.amount;
          var geoip = c["_id"]["geoip"];
          if(geoip && _.size(geoip) !== 2)
              debug("unexpected `geoip` %s", geoip);
          if(!geoip) geoip = "redacted";
          memo[geoip] = c.amount;
          return memo;
      }, { timelines: 0});
}

function getHTMLs() {
    var filter = { savingTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    return mongo
      .countByMatch(nconf.get('schema').htmls, filter);
}

function getImpressions() {
    var filter = { impressionTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    return mongo
      .countByMatch(nconf.get('schema').impressions, filter);
}

function getNewSupporters() {
    var filter = { keyTime: {
        "$gt": new Date(timeFilter.start),
        "$lt": new Date(timeFilter.end)
    } };
    return mongo
      .countByMatch(nconf.get('schema').supporters, filter);
}


function mergeAndSave(mixed) {

    var results = _.extend(timeFilter, {
        visits: mixed[0].visits,
        visitcc: _.omit(mixed[0], ['visits']),
        timelines: mixed[1].timelines,
        timelinecc: _.omit(mixed[1], ['timelines']),
        newsupp: mixed[2],
        htmls: mixed[3],
        impressions: mixed[4]
    });

    return mongo
      .read(nconf.get('schema').hourlyTI, {id: results.id })
      .then(function(exists) {
          if(_.size(exists)) {
            debug("Updting previous stats, starting at %s", results.start);
            debug("%s", JSON.stringify(results, undefined, 2));
            return mongo
              .updateOne(nconf.get('schema').hourlyTI, {id: results.id}, results);
          } else {
            debug("Writing stats, starting at %s", results.start);
            debug("%s", JSON.stringify(results, undefined, 2));
            return mongo
              .writeOne(nconf.get('schema').hourlyTI, results);
          }
      });
};


return Promise
  .all([ getFromAccesses(),
         getNewTimelines(),
         getNewSupporters(),
         getHTMLs(),
         getImpressions() ])
  .then(mergeAndSave);
