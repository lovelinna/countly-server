var plugin = {},
    crypto = require('crypto'),
    request = require('request'),
    Promise = require("bluebird"),
    CircularJSON = require('circular-json'),
	common = require('../../../api/utils/common.js'),
	authorize = require('../../../api/utils/authorizer.js'),
    countlyCommon = require('../../../api/lib/countly.common.js'),
    plugins = require('../../pluginManager.js'),
    fetch = require('../../../api/parts/data/fetch.js');

(function (plugin) {
    plugins.setConfigs("network", {
        view_limit: 1000,
        view_name_limit: 500
    });
    
    plugins.internalDrillEvents.push("[CLY]_view");
    plugins.internalDrillEvents.push("[CLY]_action");
    
    plugins.register("/i/user_merge", function(ob){
        var newAppUser = ob.newAppUser;
        var oldAppUser = ob.oldAppUser;
        if(typeof oldAppUser.vc !== "undefined"){
            if(typeof newAppUser.vc === "undefined")
                newAppUser.vc = 0;
            newAppUser.vc += oldAppUser.vc;
        }
        if(typeof oldAppUser.lvt !== "undefined"){
            if(!newAppUser.lvt || oldAppUser.lvt > newAppUser.lvt){
                newAppUser.lvt = oldAppUser.lvt;
                newAppUser.lv = oldAppUser.lv;
            }
        }
    });
    
    /*plugins.register("/i/device_id", function(ob){
		var appId = ob.app_id;
		var oldUid = ob.oldUser.uid;
		var newUid = ob.newUser.uid;
        if(oldUid != newUid){
            common.db.collection("app_network" +  appId).update({uid:oldUid}, {'$set': {uid:newUid}}, {multi:true} ,function(err, res){});
        }
	});
    
    plugins.register("/i/app_users/export", function(ob){
        return new Promise(function(resolve, reject){
            var appId = ob.app_id;
            var uids = ob.uids;
            if(!ob.export_commands["views"])
                ob.export_commands["views"] = [];
            ob.export_commands["views"].push('mongoexport ' + ob.dbstr + ' --collection app_network'+ob.app_id+' -q \'{uid:{$in: ["'+uids.join('","')+'"]}}\' --out '+ ob.export_folder+'/app_network'+ob.app_id+'.json');
            resolve();            
        });
	});
    
     plugins.register("/i/app_users/delete", function(ob){
		var appId = ob.app_id;
		var uids = ob.uids;
        if(uids && uids.length){
            common.db.collection("app_network" +  appId).remove({uid:{$in:uids}}, function(err) {});
        }
	});*/
    
    
    plugins.register("/o", function(ob){
		var params = ob.params;
        var validateUserForDataReadAPI = ob.validateUserForDataReadAPI;
		if (params.qstring.method == "network") {
			validateUserForDataReadAPI(params, function(){
                fetch.getTimeObjForEvents("app_networkdata"+params.app_id, params, {unique: "u", levels:{daily:["u","t","s","b","e","d","n"], monthly:["u","t","s","b","e","d","n"]}}, function(data){
                    common.returnOutput(params, data);
                });
            });
			return true;
		}
        else if (params.qstring.method == "get_network_segments") {
			validateUserForDataReadAPI(params, function(){
                var res = {segments:[], domains:[]};
                common.db.collection("app_networkdata"+params.app_id).findOne({'_id': "meta"}, function(err, res1){
                    if(res1 && res1.segments)
                        res.segments = res1.segments;
                    common.db.collection("app_networkdata"+params.app_id).findOne({'_id': "meta_v2"}, function(err, res2){
                        if(res2 && res2.segments)
                            common.arrayAddUniq(res.segments,Object.keys(res.segments));
                        if(common.drillDb){
                            var collectionName = "drill_events" + crypto.createHash('sha1').update("[CLY]_action" + params.qstring.app_id).digest('hex');
                            common.drillDb.collection(collectionName).findOne( {"_id": "meta_v2"},{_id:0, "sg.domain":1} ,function(err,meta){
                                if(meta && meta.sg && meta.sg.domain.values)
                                    res.domains = Object.keys(meta.sg.domain.values);
                                common.drillDb.collection(collectionName).findOne( {"_id": "meta"},{_id:0, "sg.domain":1} ,function(err,meta2){
                                    if(meta2 && meta2.sg && meta2.sg.domain)
                                        common.arrayAddUniq(res.domains, meta2.sg.domain.values);
                                    var eventHash = crypto.createHash('sha1').update("[CLY]_action" + params.qstring.app_id).digest('hex');
                                    var collectionName = "drill_meta" + params.qstring.app_id;
                                    common.drillDb.collection(collectionName).findOne( {"_id": "meta_"+eventHash},{_id:0, "sg.domain":1} ,function(err,meta){
                                        if(meta && meta.sg && meta.sg.domain.values){
                                            common.arrayAddUniq(res.domains, Object.keys(meta.sg.domain.values));
                                        }
                                        common.returnOutput(params,res);   
                                    });
                                });
                                    
                            });
                        }
                        else{
                            common.returnOutput(params,res);
                        }
                    });
                });
            });
			return true;
		} else if(params.qstring.method == 'networkerror'){
            validateUserForDataReadAPI(params, function(params){
				if (params.qstring.group) {
                    var now  = new Date();
                    var start_ts = new Date(now.toLocaleDateString()).getTime();
                    var end_ts = now.getTime();
                    if('hour'==params.qstring.period){
                        //不作处理
                    }else if('yesterday'==params.qstring.period){
                        end_ts = start_ts;
                        start_ts -= 86400000;
                    }else if('month'==params.qstring.period){
                        now.setDate(1);
                        now.setMonth(0);
                        now.setHours(0);
                        now.setMinutes(0);
                        start_ts = now.getTime();
                    }else if('day'==params.qstring.period){
                        now.setMonth(0);
                        start_ts = now.getTime();
                    }else if('7days'==params.qstring.period){
                        start_ts = end_ts - 7*86400000;
                    }else if('30days'==params.qstring.period){
                        start_ts = end_ts - 30*86400000;
                    }else if('60days'==params.qstring.period){
                        start_ts = end_ts - 60*86400000;
                    }
                    console.log("start_ts="+start_ts+" and end_ts="+end_ts+" and group="+params.qstring.group);
                    var cursor = common.db.collection('app_networkerror' + params.app_id).find({group:params.qstring.group, ts:{$gte:start_ts, $lte:end_ts}}).sort( { $natural: -1 } );
                    cursor.limit(plugins.getConfig("crashes").report_limit);
                    cursor.toArray(function(err, res){
                            common.returnOutput(params, res);
                    });

				}
			});
			return true;
		}else if(params.qstring.method == 'metrics'){
            validateUserForDataReadAPI(params, function(params){
                    var result = {};
                        result.users = {};
                        result.users.total = 0;
                        result.users.affected = 0;
                        result.users.fatal = 0;
                        result.users.nonfatal = 0;
                        result.crashes = {};
                        result.crashes.total = 0;
                        result.crashes.unique = 0;
                        result.crashes.resolved = 0;
                        result.crashes.unresolved = 0;
                        result.crashes.fatal = 0;
                        result.crashes.nonfatal = 0;
                        result.crashes.news = 0;
                        result.crashes.renewed = 0;
                        result.crashes.os = {};
                        result.crashes.highest_app = "";
                        result.loss = 0;
                        result.users.affected = 0;
                        result.users.fatal =  0;
                        result.users.nonfatal = 0;
                        result.crashes.total =  0;
                        result.crashes.unique =  0;
                        result.crashes.resolved =  0;
                        result.crashes.unresolved = 0;
                        result.crashes.fatal =  0;
                        result.crashes.nonfatal = 0;
                        result.crashes.news =  0;
                        result.crashes.renewed =  0;
                        result.crashes.os =  {};
                        result.loss =  0;
                        result.crashes.highest_app ="0:0";
                        console.log("params",CircularJSON.stringify(params));
                        fetch.getTimeObj("networkmetricdata", params, {}, function(data){
                            result.data = data;
                            console.log("data", JSON.stringify(data));
                            common.returnOutput(params, result);
                        });
                    });
            return true;
            }
		return false;
	});
    
    plugins.register("/o/urltest", function(ob){
        var params = ob.params;
        if(params.qstring.url){
            var options = {
                url: params.qstring.url,
                headers: {
                    'User-Agent': 'CountlySiteBot'
                }
            };
            request(options, function (error, response, body) {
                if (!error && response.statusCode >= 200 && response.statusCode < 400) {
                    common.returnOutput(params,{result:true});
                }
                else{
                    common.returnOutput(params,{result:false});
                }
            });
        }
        else{
            common.returnOutput(params,{result:false});
        }
        return true;
    });
    
    function getHeatmap(params){
        var result = {types:[], data:[]};
        var devices = [
            {
                type: "all",
                displayText: "All",
                minWidth: 0,
                maxWidth: 10240
            },
            {
                type: "mobile",
                minWidth: 0,
                maxWidth: 767
            },
            {
                type: "tablet",
                minWidth: 767,
                maxWidth: 1024
            },
            {
                type: "desktop",
                minWidth: 1024,
                maxWidth: 10240
            },  
        ];

        var deviceType = params.qstring.deviceType;
        var actionType = params.qstring.actionType;
        var device = devices.filter((device) => {
            return device.type == deviceType;
        });

        if(!device.length){
            common.returnMessage(params, 400, 'Bad request parameter: device type');
            return false;
        }
        var collectionName = "drill_events" + crypto.createHash('sha1').update("[CLY]_action" + params.qstring.app_id).digest('hex');
        common.drillDb.collection(collectionName).findOne( {"_id": "meta_v2"},{_id:0, "sg.type":1, "sg.domain":1} ,function(err,meta){
            if(meta && meta.sg && meta.sg.type)
                result.types = Object.keys(meta.sg.type.values);
            else
                result.types = [];
            if(meta && meta.sg && meta.sg.domain)
                result.domains = Object.keys(meta.sg.domain.values).map(function(item){return common.db.decode(item);});
            else
                result.domains = [];
            common.drillDb.collection(collectionName).findOne( {"_id": "meta"},{_id:0, "sg.type":1, "sg.domain":1} ,function(err,meta2){
                if(meta2 && meta2.sg && meta2.sg.type)
                    common.arrayAddUniq(result.types, meta2.sg.type.values);
                if(meta2 && meta2.sg && meta2.sg.domain)
                    common.arrayAddUniq(result.domains, meta2.sg.domain.values);
                var eventHash = crypto.createHash('sha1').update("[CLY]_action" + params.qstring.app_id).digest('hex');
                var collectionMeta = "drill_meta" + params.qstring.app_id;
                common.drillDb.collection(collectionMeta).findOne( {"_id": "meta_"+eventHash},{_id:0, "sg.domain":1} ,function(err,meta_event){
                    if(meta_event && meta_event.sg && meta_event.sg.type)
                        common.arrayAddUniq(result.types, Object.keys(meta_event.sg.type.values));
                    if(meta_event && meta_event.sg && meta_event.sg.domain)
                        common.arrayAddUniq(result.domains, Object.keys(meta_event.sg.domain.values));
                     
                    if (params.qstring.period) {
                        //check if period comes from datapicker
                        if (params.qstring.period.indexOf(",") !== -1) {
                            try {
                                params.qstring.period = JSON.parse(params.qstring.period);
                            } catch (SyntaxError) {
                                console.log('Parsing custom period failed!');
                                common.returnMessage(params, 400, 'Bad request parameter: period');
                                return false;
                            }
                        }
                        else{
                            switch (params.qstring.period){
                                case "month":
                                case "day":
                                case "yesterday":
                                case "hour":
                                    break;
                                default:
                                    if(!/([0-9]+)days/.test(params.qstring.period)){
                                        common.returnMessage(params, 400, 'Bad request parameter: period');
                                        return false;
                                    }
                                    break;
                            }
                        }
                    } else {
                        common.returnMessage(params, 400, 'Missing request parameter: period');
                        return false;
                    }
                    countlyCommon.setTimezone(params.appTimezone);
                    countlyCommon.setPeriod(params.qstring.period);
                    var periodObj = countlyCommon.periodObj,
                        queryObject = {},
                        now = params.time.now.toDate();
            
                    //create current period array if it does not exist
                    if (!periodObj.currentPeriodArr) {
                        periodObj.currentPeriodArr = [];
            
                        //create a period array that starts from the beginning of the current year until today
                        if (params.qstring.period == "month") {
                            for (var i = 0; i < (now.getMonth() + 1); i++) {
                                var daysInMonth = moment().month(i).daysInMonth();
            
                                for (var j = 0; j < daysInMonth; j++) {
                                    periodObj.currentPeriodArr.push(periodObj.activePeriod + "." + (i + 1) + "." + (j + 1));
            
                                    // If current day of current month, just break
                                    if ((i == now.getMonth()) && (j == (now.getDate() - 1))) {
                                        break;
                                    }
                                }
                            }
                        }
                        //create a period array that starts from the beginning of the current month until today
                        else if(params.qstring.period == "day") {
                            for(var i = 0; i < now.getDate(); i++) {
                                periodObj.currentPeriodArr.push(periodObj.activePeriod + "." + (i + 1));
                            }
                        }
                        //create one day period array
                        else{
                            periodObj.currentPeriodArr.push(periodObj.activePeriod);
                        }
                    }
        
                    //get timestamps of start of days (DD-MM-YYYY-00:00) with respect to apptimezone for both beginning and end of period arrays
                    var tmpArr;
                    queryObject.ts = {};
            
                    tmpArr = periodObj.currentPeriodArr[0].split(".");
                    queryObject.ts.$gte = new Date(Date.UTC(parseInt( tmpArr[0]),parseInt(tmpArr[1])-1,parseInt(tmpArr[2]) ));
                    queryObject.ts.$gte.setTimezone(params.appTimezone);
                    queryObject.ts.$gte = queryObject.ts.$gte.getTime() + queryObject.ts.$gte.getTimezoneOffset()*60000;
            
                    tmpArr = periodObj.currentPeriodArr[periodObj.currentPeriodArr.length - 1].split(".");
                    queryObject.ts.$lt = new Date(Date.UTC(parseInt( tmpArr[0]),parseInt(tmpArr[1])-1,parseInt(tmpArr[2]) ));
                    queryObject.ts.$lt.setDate(queryObject.ts.$lt.getDate() + 1);
                    queryObject.ts.$lt.setTimezone(params.appTimezone);
                    queryObject.ts.$lt = queryObject.ts.$lt.getTime() + queryObject.ts.$lt.getTimezoneOffset()*60000;
                    
                    queryObject["sg.width"] = {};
                    queryObject["sg.width"].$gt = device[0].minWidth;
                    queryObject["sg.width"].$lte = device[0].maxWidth;
                    queryObject["sg.type"] = actionType;

                    var projections = {
                        _id:0, 
                        c:1, 
                        "sg.type":1, 
                        "sg.width":1, 
                        "sg.height":1
                    };

                    if(actionType == "scroll"){
                        projections["sg.y"] = 1;
                        queryObject["sg.view"] = params.qstring.view;                        
                    }else {
                        projections["sg.x"] = 1;                    
                        projections["sg.y"] = 1;   
                        queryObject["up.lv"] = params.qstring.view;                        
                    }

                    if(params.qstring.segment)
                        queryObject["sg.segment"] = params.qstring.segment;
                    common.drillDb.collection(collectionName).find( queryObject, projections).toArray(function(err,data){
                        result.data = data;
                        common.returnOutput(params,result,true,params.token_headers);
                    });
                });
            });
        });
    }
    
    plugins.register("/o/actions", function(ob){
		var params = ob.params;
		var validateUserForDataReadAPI = ob.validateUserForDataReadAPI;
		if (common.drillDb && params.qstring.view) {
            if(params.req.headers["countly-token"]){
                authorize.verify({db:common.db, token:params.req.headers["countly-token"], callback:function(valid){
                    if(valid){
                        authorize.save({db:common.db, ttl:1800 ,callback:function(err, token){
                            params.token_headers = {"countly-token": token, "content-language":token, "Access-Control-Expose-Headers":"countly-token"};
                            common.db.collection('apps').findOne({'key':params.qstring.app_key}, function (err, app) {
                                if (!app) {
                                    common.returnMessage(params, 401, 'App does not exist');
                                    return false;
                                }
                                params.app_id = app['_id'];
                                params.qstring.app_id = app['_id']+"";
                                params.app_cc = app['country'];
                                params.appTimezone = app['timezone'];
                                params.app = app;
                                params.time = common.initTimeObj(params.appTimezone, params.qstring.timestamp);
                                getHeatmap(params);
                            });
                        }});
                    }
                    else{
                        common.returnMessage(params, 401, 'User does not have view right for this application');
                    }
                }});
            }
            else{
                validateUserForDataReadAPI(params, getHeatmap);
            }
			return true;
		}
		return false;
	});
    
    plugins.register("/session/post", function(ob){
        return new Promise(function(resolve, reject){
            var params = ob.params;
            var dbAppUser = ob.dbAppUser;
            if(dbAppUser && dbAppUser.vc){
                var user = params.app_user;
                if(user && user.vc){
                    var ranges = [
                        [0,2],
                        [3,5],
                        [6,10],
                        [11,15],
                        [16,30],
                        [31,50],
                        [51,100]
                    ],
                    rangesMax = 101,
                    calculatedRange,
                    updateUsers = {},
                    updateUsersZero = {},
                    dbDateIds = common.getDateIds(params),
                    monthObjUpdate = [];
        
                    if (user.vc >= rangesMax) {
                        calculatedRange = (ranges.length) + '';
                    } else {
                        for (var i=0; i < ranges.length; i++) {
                            if (user.vc <= ranges[i][1] && user.vc >= ranges[i][0]) {
                                calculatedRange = i + '';
                                break;
                            }
                        }
                    }
                
                    monthObjUpdate.push('vc.' + calculatedRange);
                    common.fillTimeObjectMonth(params, updateUsers, monthObjUpdate);
                    common.fillTimeObjectZero(params, updateUsersZero, 'vc.' + calculatedRange);
                    var postfix = common.crypto.createHash("md5").update(params.qstring.device_id).digest('base64')[0];
                    common.db.collection('users').update({'_id': params.app_id + "_" + dbDateIds.month + "_" + postfix}, {'$inc': updateUsers}, function(){});
                    var update = {'$inc': updateUsersZero, '$set': {}};
                    update["$set"]['meta_v2.v-ranges.' +  calculatedRange] = true;
                    common.db.collection('users').update({'_id': params.app_id + "_" + dbDateIds.zero + "_" + postfix}, update, function(err, res){});
                    
                    if(user.lv){
                        if(ob.end_session || user.lvt && params.time.timestamp - user.lvt > 300){
                            var segmentation = {name:user.lv.replace(/^\$/, "").replace(/\./g, "&#46;"), exit:1};
                            if(user.vc == 1){
                                segmentation.bounce = 1;
                            }
                            recordMetrics(params, {key:"[CLY]_view", segmentation:segmentation}, user);
                        }
                    }
                    common.updateAppUser(params, {$set:{vc:0}});
                    resolve();
                }
                else{
                    resolve();
                }
            }
            else{
                resolve();
            }
        });
    });
    
    plugins.register("/i", function(ob){
        return new Promise(function(resolve, reject){
            var params = ob.params;
            if (params.qstring.events && params.qstring.events.length && Array.isArray(params.qstring.events)) {
                if(!params.network){
                    params.network = [];
                }
                params.qstring.events = params.qstring.events.filter(function(currEvent){
                    if (currEvent.key == "[CLY]_network"){
                        if(currEvent.segmentation && currEvent.segmentation.name){      
                            //truncate view name if needed
                            if(currEvent.segmentation.name.length > plugins.getConfig("network").view_name_limit){
                                currEvent.segmentation.name = currEvent.segmentation.name.slice(0,plugins.getConfig("network").view_name_limit);
                            }
                            currEvent.dur = Math.round(currEvent.dur || currEvent.segmentation.dur || 0);
                            //bug from SDK possibly reporting timestamp instead of duration
                            if(currEvent.dur && (currEvent.dur+"").length >= 10)
                                currEvent.dur = 0;
                            
                            processView(params, currEvent);
                            if(currEvent.segmentation.visit){
                                params.network.push(currEvent);
                                var events = [currEvent];
                                plugins.dispatch("/plugins/drill", {params:params, dbAppUser:params.app_user, events:events});
                            }
                            else{
                                if(currEvent.dur){
                                    plugins.dispatch("/view/duration", {params:params, duration:currEvent.dur});
                                }
                            }
                        }
                        return false;
                    }
                    return true;
                });
            }
            resolve();
        });
    });
    
    function processView(params, currEvent){
        if (currEvent.key == "[CLY]_network"){
            var escapedMetricVal = common.db.encode(currEvent.segmentation.name+"");
                
            var update = {$set:{lv:currEvent.segmentation.name}};
            
            if(currEvent.segmentation.visit){
                update["$inc"] = {vc:1};
                update["$max"] = {lvt:params.time.timestamp};
            }
            common.updateAppUser(params, update);
            if(currEvent.segmentation.visit){
                var lastView = {};
                lastView[escapedMetricVal] = params.time.timestamp;           
                common.db.collection('app_network' + params.app_id).findAndModify({'_id': params.app_user_id },{}, {$max:lastView},{upsert:true, new:false}, function (err, view){
                    recordMetrics(params, currEvent, params.app_user, view && view.ok ? view.value : null);
                });
            }
            else{
                recordMetrics(params, currEvent, params.app_user);
            }
        }
	}
    
    function recordMetrics(params, currEvent, user, view){
        if (currEvent.key == "[CLY]_network"){
            var tmpMetric = { name: "_view", set: "network", short_code: "v" },
            tmpTimeObjZero = {},
            tmpTimeObjMonth = {},
            tmpSet = {},
            zeroObjUpdate = [],
            monthObjUpdate = [],
            escapedMetricVal = common.db.encode(currEvent.segmentation.name+""),
            postfix = common.crypto.createHash("md5").update(escapedMetricVal).digest('base64')[0];
        
            //making sure metrics are strings
            tmpSet["meta_v2." + tmpMetric.set + "." + escapedMetricVal] = true;

        


            
            var dateIds = common.getDateIds(params),
                tmpZeroId = "no-segment_" + dateIds.zero + "_" + postfix,
                tmpMonthId = "no-segment_" + dateIds.month + "_" + postfix;
                    
            common.db.collection("app_networkdata"+params.app_id).findOne({'_id': tmpZeroId}, {meta_v2:1}, function(err, res){
                //checking if view should be ignored because of limit
                if(!err && res && res.meta_v2 && res.meta_v2.network &&
                    typeof res.meta_v2.network[escapedMetricVal] === "undefined" &&
                    Object.keys(res.meta_v2.network).length >= plugins.getConfig("network").view_limit){
                    return;
                }
                //如果visit有值，说明访问了此接口
                if(!currEvent.segmentation.resbytes){
                    currEvent.segmentation.resbytes = 100;
                }
                if(currEvent.segmentation.visit==1){
                    //访问总数要更新
                    monthObjUpdate.push(escapedMetricVal + '.' + common.dbMap['total']);
                    //如果之前没有访问过，说明是新增
                    if (view && !view[escapedMetricVal]) {
                        monthObjUpdate.push(escapedMetricVal + '.' + common.dbMap['new']);
                    }
                    /**
                     * 计算unique次数
                     */
                    //如果以前有访问过
                    // if (view && view[escapedMetricVal]) {
                    //     var lastViewTimestamp = view[escapedMetricVal],
                    //         currDate = common.getDate(params.time.timestamp, params.appTimezone),
                    //         lastViewDate = common.getDate(lastViewTimestamp, params.appTimezone),
                    //         secInMin = (60 * (currDate.getMinutes())) + currDate.getSeconds(),
                    //         secInHour = (60 * 60 * (currDate.getHours())) + secInMin,
                    //         secInMonth = (60 * 60 * 24 * (currDate.getDate() - 1)) + secInHour,
                    //         secInYear = (60 * 60 * 24 * (common.getDOY(params.time.timestamp, params.appTimezone) - 1)) + secInHour;
                    //     //当前小时的unique次数
                    //     if (lastViewTimestamp < (params.time.timestamp - secInMin)) {
                    //         tmpTimeObjMonth['d.' + params.time.day + '.' + params.time.hour + '.' + escapedMetricVal + '.' + common.dbMap['unique']] = 1;
                    //     }
                    //     //当前天的unique次数
                    //     if (lastViewTimestamp < (params.time.timestamp - secInHour)) {
                    //         tmpTimeObjMonth['d.' + params.time.day + '.' + escapedMetricVal + '.' + common.dbMap['unique']] = 1;
                    //     }
                    //     //当前周的unique次数
                    //     if (lastViewDate.getFullYear() == params.time.yearly &&
                    //         Math.ceil(common.moment(lastViewDate).tz(params.appTimezone).format("DDD") / 7) < params.time.weekly) {
                    //         tmpTimeObjZero["d.w" + params.time.weekly + '.' + escapedMetricVal + '.' + common.dbMap['unique']] = 1;
                    //     }
                    //     //当前月
                    //     if (lastViewTimestamp < (params.time.timestamp - secInMonth)) {
                    //         tmpTimeObjZero['d.' + params.time.month + '.' + escapedMetricVal + '.' + common.dbMap['unique']] = 1;
                    //     }
                    //     //当前年
                    //     if (lastViewTimestamp < (params.time.timestamp - secInYear)) {
                    //         tmpTimeObjZero['d.' + escapedMetricVal + '.' + common.dbMap['unique']] = 1;
                    //     }
                    // }
                    // else{//以前没有访问过
                    //     common.fillTimeObjectZero(params, tmpTimeObjZero, escapedMetricVal + '.' + common.dbMap['unique']);
                    //     common.fillTimeObjectMonth(params, tmpTimeObjMonth, escapedMetricVal + '.' + common.dbMap['unique'], 1, true);
                    // }
                }
                
                // if(currEvent.segmentation.start){
                //     monthObjUpdate.push(escapedMetricVal + '.s');
                // }

                var metrics = ["cr"];
                                                    
            
                
                if(currEvent.segmentation.code && currEvent.segmentation.code!=200){
                    metrics.push("cru");
                    monthObjUpdate.push(escapedMetricVal + '.e');

                    var props = [
                        //device metrics
                        "os",
                        "os_version",
                        "manufacture", //may not be provided for ios or be constant, like Apple
                        "device", //model for Android, iPhone1,1 etc for iOS
                        "resolution",
                        "app_version",
                        "cpu", //type of cpu used on device (for ios will be based on device)
                        "opengl", //version of open gl supported
                        "view", //screen, view or page where error happened
                        "browser", //browser in which error happened, if applicable
                        
                        //state of device
                        "ram_current", //in megabytes
                        "ram_total",
                        "disk_current", //in megabytes
                        "disk_total",
                        "bat_current", //battery level, probably usually from 0 to 100
                        "bat_total", //but for consistency also provide total
                        "bat", //or simple value from 0 to 100
                        "orientation", //in which device was held, landscape, portrait, etc
                        
                        //bools
                        "root", //true if device is rooted/jailbroken, false or not provided if not
                        "online", //true if device is connected to the internet (WiFi or 3G), false or not provided if not connected
                        "muted", //true if volume is off, device is in muted state
                        "signal", //true if have cell/gsm signal or is not in airplane mode, false when no gsm signal or in airplane mode
                        "background", //true if app was in background when it crashed
                        
                        //error info
                        "name", //optional if provided by OS/Platform, else will use first line of stack
                        "type", //optional type of the error
                        "error", //error stack
                        "nonfatal", //true if handled exception, false or not provided if crash
                        "logs",//some additional logs provided, if any 
                        "run", //running time since app start in seconds
                        
                        //build specific fields
                        "architecture",
                        "app_build",
                        "binary_images",
                        "build_uuid",
                        "executable_name",
                        "load_address",
                        
                        //custom key/values provided by developers
                        "custom"
                    ];
                    var report = {
                        "os" : "Android",
                        "os_version" : "6.0",
                        "manufacture" : "HTC",
                        "device" : "HTC D816t",
                        "resolution" : "720x1184",
                        "app_version" : "1.0",
                        "cpu" : "armeabi-v7a",
                        "opengl" : "3",
                        "ram_current" : "853",
                        "ram_total" : "1334",
                        "disk_current" : "1532",
                        "disk_total" : "2516",
                        "bat" : "86.0",
                        "orientation" : "Portrait",
                        "root" : 0,
                        "online" : 1,
                        "muted" : 0,
                        "background" : 1,
                        "error" : "java.lang.ArrayIndexOutOfBoundsException: length=0; index=0\nat ly.count.android.demo.CrashReportingActivity.c(SourceFile:59)\nat ly.count.android.demo.CrashReportingActivity.onClick(SourceFile:37)\nat android.view.View.performClick(View.java:5226)\nat android.view.View$PerformClick.run(View.java:21265)\nat android.os.Handler.handleCallback(Handler.java:739)\nat android.os.Handler.dispatchMessage(Handler.java:95)\nat android.os.Looper.loop(Looper.java:168)\nat android.app.ActivityThread.main(ActivityThread.java:5845)\nat java.lang.reflect.Method.invoke(Native Method)\nat com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:797)\nat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:687)",
                        "nonfatal" : false,
                        "code":500,
                        "run" : "2026",
                        "not_os_specific" : false,
                        "group" : "544bfc4077b97b14b8f6f1d4c815199330dbb33d",
                        "uid" : "4",
                        "resbytes" : 200,
                        "ts" : 1528683110
                    };
                    for(var i = 0, l = props.length; i < l; i++){
                        if(currEvent.segmentation[props[i]] != null){
                            report[props[i]] = currEvent.segmentation[props[i]];
                        }
                    }
                    report.cd=new Date();
                    report.ts=currEvent.timestamp;
                    // report.view=currEvent.segmentation.name;
                    report.name=currEvent.segmentation.err_breif;
                    report.url=currEvent.segmentation.name;
                    // report.error=currEvent.segmentation.errorinfo;
                    report.code=currEvent.segmentation.code;
                    report.group=common.crypto.createHash("md5").update(currEvent.segmentation.name).digest('hex');
                
                    common.db.collection("app_networkerror"+params.app_id).insert(report, {'upsert': true}, function(err, res){});
                }
                
                common.recordCustomMetric(params, "networkmetricdata", params.app_id, metrics, 1, null, null, currEvent.timestamp);
                if(currEvent.segmentation.code && currEvent.segmentation.code==200){
                    common.recordCustomMetric(params, "networkmetricdata", params.app_id, ["crnf"], Number(currEvent.dur), null, ["cr"], currEvent.timestamp);
                    common.recordCustomMetric(params, "networkmetricdata", params.app_id, ["crf"], Number(currEvent.segmentation.resbytes), null, ["cr"], currEvent.timestamp);
                }
                // if(currEvent.segmentation.bounce){
                //     monthObjUpdate.push(escapedMetricVal + '.b');
                // }
                
                common.fillTimeObjectZero(params, tmpTimeObjZero, zeroObjUpdate);
                common.fillTimeObjectMonth(params, tmpTimeObjMonth, monthObjUpdate, 1, true);
                
                if(currEvent.dur){
                    var dur = parseInt(currEvent.dur);
                    common.fillTimeObjectMonth(params, tmpTimeObjMonth, escapedMetricVal + '.' + common.dbMap['duration'], dur, true);
                }
                if(typeof currEvent.segmentation.segment != "undefined"){
                    currEvent.segmentation.segment = common.db.encode(currEvent.segmentation.segment+"");
                    var update = {$set:{}};
                    update["$set"]["segments."+currEvent.segmentation.segment] =  true;
                    common.db.collection("app_networkdata"+params.app_id).update({'_id': "meta_v2"}, update, {'upsert': true}, function(err, res){});
                }
                
                if (Object.keys(tmpTimeObjZero).length || Object.keys(tmpSet).length) {
                    tmpSet.m = dateIds.zero;
                    tmpSet.a = params.app_id + "";
                    var update = {$set: tmpSet};
                    if(Object.keys(tmpTimeObjZero).length)
                        update["$inc"] = tmpTimeObjZero;
                    common.db.collection("app_networkdata"+params.app_id).update({'_id': tmpZeroId}, update, {'upsert': true}, function(){});
                    if(typeof currEvent.segmentation.segment != "undefined"){
                        common.db.collection("app_networkdata"+params.app_id).update({'_id': currEvent.segmentation.segment+"_"+dateIds.zero + "_" + postfix}, update, {'upsert': true}, function(){});
                    }
                }
                
                if (Object.keys(tmpTimeObjMonth).length){
                    var update = {$set: {m: dateIds.month, a: params.app_id + ""}};
                    if(Object.keys(tmpTimeObjMonth).length)
                        update["$inc"] = tmpTimeObjMonth;
                    common.db.collection("app_networkdata"+params.app_id).update({'_id': tmpMonthId}, update, {'upsert': true}, function(){});
                    if(typeof currEvent.segmentation.segment != "undefined"){
                        common.db.collection("app_networkdata"+params.app_id).update({'_id': currEvent.segmentation.segment+"_"+dateIds.month + "_" + postfix}, update, {'upsert': true}, function(){});
                    }
                }
            });
        }
    }
    
    plugins.register("/i/apps/create", function(ob){
		var params = ob.params;
		var appId = ob.appId;
        common.db.collection("app_networkdata" + appId).insert({_id:"meta_v2"},function(){});
        common.db.collection('app_network' + appId).ensureIndex({"uid":1},function(){});
	});
	
	plugins.register("/i/apps/delete", function(ob){
		var appId = ob.appId;
		common.db.collection('app_networkdata' + appId).drop(function() {});
		common.db.collection('app_network' + appId).drop(function() {});
        if(common.drillDb){
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_action" + appId).digest('hex')).drop(function() {});
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_view" + appId).digest('hex')).drop(function() {});
        }
	});
    
    plugins.register("/i/apps/clear_all", function(ob){
		var appId = ob.appId;
        common.db.collection('app_networkdata' + appId).drop(function() {
            common.db.collection("app_networkdata" + appId).insert({_id:"meta_v2"},function(){});
        });
		common.db.collection('app_network' + appId).drop(function() {
            common.db.collection('app_network' + appId).ensureIndex({"uid":1},function(){});
        });
        if(common.drillDb){
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_action" + appId).digest('hex')).drop(function() {});
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_network" + appId).digest('hex')).drop(function() {});
        }
	});
    
    plugins.register("/i/apps/clear", function(ob){
		var appId = ob.appId;
        var ids = ob.ids;
        var dates = ob.dates;
        common.db.collection('app_networkdata' + appId).findOne({_id:"meta_v2"}, function(err, doc){
            if(!err && doc && doc.segments){
                var segments = Object.keys(doc.segments);
                segments.push("no-segment");
                var docs = [];
                for(var j = 0; j < segments.length; j++){
                    for(var k = 0; k < dates.length; k++){
                        docs.push(segments[j]+"_"+dates[k]);
                    }
                }
                common.db.collection('app_networkdata' + appId).remove({'_id': {$nin:docs}},function(){});
            }
        });
        if(common.drillDb){
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_action" + appId).digest('hex')).remove({ts:{$lt:ob.moment.valueOf()}}, function() {});
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_view" + appId).digest('hex')).remove({ts:{$lt:ob.moment.valueOf()}}, function() {});
        }
	});
	
	plugins.register("/i/apps/reset", function(ob){
		var appId = ob.appId;
        common.db.collection('app_networkdata' + appId).drop(function() {
            common.db.collection("app_networkdata" + appId).insert({_id:"meta_v2"},function(){});
        });
		common.db.collection('app_network' + appId).drop(function() {
            common.db.collection('app_network' + appId).ensureIndex({"uid":1},function(){});
        });
        if(common.drillDb){
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_action" + appId).digest('hex')).drop(function() {});
            common.drillDb.collection("drill_events" + crypto.createHash('sha1').update("[CLY]_view" + appId).digest('hex')).drop(function() {});
        }
	});
	
}(plugin));

module.exports = plugin;