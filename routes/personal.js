const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const debug = require('debug')('routes:personal');
const pug = require('pug');
const nconf = require('nconf');

const mongo = require('../lib/mongo');
const params = require('../lib/params');
const utils = require('../lib/utils');
const adopters = require('../lib/adopters');
const produceCSVv1 = require('../lib/CSV');

function summary(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 200);
    debug("summary request, amount %d skip %d", amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .map(function(e) {
            return _.omit(e, ['_id' ]);
        })
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("data (error): %s", e);
            return { 'text': `error: ${e}` };
        });
};

function personalCSV(req) {
    const { amount, skip } = params.optionParsing(req.params.paging, 1000);
    debug("CSV request by [%s], amount %d skip %d", req.params.userToken, amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').summary, { user: supporter.pseudo },
                    { impressionTime: -1}, amount, skip);
        })
        .tap(function(check) {
            if(!_.size(check)) throw new Error("Invalid token");
        })
        .then(produceCSVv1)
        .then(function(structured) {
            debug("personalCSV produced %d bytes", _.size(structured));
            const fname=`summary-${skip}-${amount}.csv`;
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=${fname}` },
                text: structured,
            };
        })
        .catch(function(e) {
            debug("csv (error): %s", e);
            return { text: `error: ${e}` };
        });
}

function timelineCSV(req) {
    const timelineId = req.params.timelineId;
    const timelineP = utils.pseudonymizeTmln(timelineId);
    debug("timeline CSV request (Id %s -> p %s)", timelineId, timelineP);

    return mongo
        .read(nconf.get('schema').summary, { timeline: timelineP }, { impressionTime: -1})
        .then(produceCSVv1)
        .tap(function(check) {
            if(!_.size(check)) throw new Error("Invalid timelineId");
        })
        .then(function(structured) {
            debug("timelineCSV produced %d bytes", _.size(structured));
            const fname=`timeline-${timelineP}.csv`;
            return {
                headers: { "Content-Type": "csv/text",
                           "content-disposition": `attachment; filename=${fname}` },
                text: structured,
            };
        });
}

function metadata(req) {

    throw new Error("NIATM");
    // not implemented an endpoint, at the moment

    const { amount, skip } = params.optionParsing(req.params.paging);
    debug("metadata request: %d skip %d", amount, skip);
    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return mongo
                .readLimit(nconf.get('schema').metadata, { userId: supporter.userId },
                    { impressionTime: -1}, amount, skip);
        })
        .then(function(data) {
            debug("retrived %d objects, with amount %d skip %d", _.size(data), amount, skip);
            return { json: data };
        })
        .catch(function(e) {
            debug("data (error): %s", e);
            return { 'text': `error: ${e}` };
        });
};

function semantics(req) {
    const { amount, skip } = params.optionParsing(req.params.paging);
    debug("semantics request: %d, skip %d", amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            let ma = { $match: { user: supporter.pseudo } };
            let li = { $limit: (amount * 2) };
            let so = { $sort: { impressionTime: -1 } };
            let lo = { $lookup: {
                from: 'labels',
                localField: 'semanticId',
                foreignField: 'semanticId',
                as: 'labelcopy'
            } };
            return mongo
                .aggregate(nconf.get('schema').summary, [ ma, li, so, lo ])
            // TODO remove the map below
            // TODO match by semanticId 
            // ensure the amount/skip pagin is respected
        })
        .map(function(e) {
            if(_.size(e.labelcopy)) {
                e.labels = _.get(e.labelcopy[0], 'l');
                e.lang = _.get(e.labelcopy[0], 'lang');
            }
            return _.omit(e, ['_id', 'id', 'labelcopy' ]);
        })
        .then(function(prod) {
            return { json: prod };
        });
};

function byTimelineLookup(userId, amount, skipnum) {
    /* let me intrduce you to the bigger pipeline of this code iteration */

    const match = { $match: {userId: userId }};
    const sort = { $sort: { startTime: -1 }};
    const skip = { $skip: skipnum };
    const limit = { $limit: amount };
    const lookup = { $lookup: { from: 'impressions2', localField: 'id', foreignField: 'timelineId', as: 'impressions'}};
    const unwind = { $unwind: { path: "$impressions", preserveNullAndEmptyArrays: true } };
    const project = { $project: {
        _id: 0,
        "impressionOrder": "$impressions.impressionOrder",
        "impressionTime": "$impressions.impressionTime",
        "htmlId": "$impressions.htmlId",
        geoip: 1,
        startTime: 1,
        "timelineId": "$id"
    }};
    const summaryl = { $lookup: { from: 'summary', localField: 'htmlId', foreignField: 'id', as: 'summary'  }};

    return mongo
        .aggregate(nconf.get('schema').timelines, [ match, sort, skip, limit, lookup, unwind, project, summaryl ]);
};

function stats(req) {
    const DEFTIMLN = 20;
    const { amount, skip } = params.optionParsing(req.params.paging, DEFTIMLN);
    debug("Personal statistics requested, amount: %d, skip %d", amount, skip);

    return adopters
        .validateToken(req.params.userToken)
        .then(function(supporter) {
            return Promise.all([
                mongo.count(nconf.get('schema').timelines, { userId: supporter.userId }),
                byTimelineLookup(supporter.userId, amount, skip)
            ])
        })
        .then(function(result) {
            const timelines = _.countBy(result[1], 'timelineId')
            debug("Retrieved %d impressions in %d timelines, first %s, last %s",
                _.size(result[1]), _.size(timelines), _.first(result[1]).impressionTime, _.last(result[1]).impressionTime);

            /* order the timeline by startTime and impressionOrder */
            const orderedTimelines = _.map(_.map(_.groupBy(result[1], 'timelineId'), _.first), 'startTime');
            let sorted = [];
            _.each(_.orderBy(orderedTimelines, new Date), function(sT) {
                sorted = _.concat(sorted, _.orderBy(_.filter(result[1], { startTime: sT }), 'impressionOrder'));
            });

            return {
                json: {
                    storedTimelines: result[0],
                    served: { amount, skip },
                    content: sorted,
                    timelines,
                }
            };
        });

};

function daily(req) {
     /* https://github.com/tracking-exposed/facebook/issues/117
      * This API is based on `summary` but aggregated by hours
      * take in account */
    throw new Error("NIATM");
};

module.exports = {
    summary,
    metadata,
    personalCSV,
    timelineCSV,
    semantics,
    daily,
    stats
};
