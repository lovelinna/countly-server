(function () {
    window.countlyNetwork = window.countlyNetwork || {};
    CountlyHelpers.createMetricModel(window.countlyNetwork, {name: "network"}, jQuery);
    //Private Properties
    var _periodObj = {},
        _crashTimeline = {},
        _crashData = {},
        _actionData = {},
        _activeAppKey = 0,
        _initialized = false,
        _segment = null,
        _segments = [],
        _domains = [],
        _name = "network",
        _groupData = {},
        _period = null;

    //Public Methods
    countlyNetwork.initialize = function (id, isRefresh) {
        if (_initialized &&  _period == countlyCommon.getPeriodForAjax() && _activeAppKey == countlyCommon.ACTIVE_APP_KEY) {
            return this.refresh(id);
        }

        _period = countlyCommon.getPeriodForAjax();


        if(id){
            if('metrics'==id){
                return $.ajax({
                    type:"GET",
                    url:countlyCommon.API_PARTS.data.r,
                    data:{
                        "api_key":countlyGlobal.member.api_key,
                        "app_id":countlyCommon.ACTIVE_APP_ID,
                        "period":_period,
                        "method":"metrics",
                        "graph":1,
                        "display_loader": !isRefresh
                    },
                    dataType:"jsonp",
                    success:function (json) {
                        _crashData = json;
                        _crashTimeline = json.data;
                       
                        setMeta();
                        if(_crashData.crashes.latest_version == "")
                            _crashData.crashes.latest_version = "None";
                        if(_crashData.crashes.error == "")
                            _crashData.crashes.error = "None";
                        if(_crashData.crashes.os == "")
                            _crashData.crashes.os = "None";
                        if(_crashData.crashes.highest_app == "")
                            _crashData.crashes.highest_app = "None";
                    }
                });
            }else{
                _lastId = id;
                return $.ajax({
                    type:"GET",
                    url:countlyCommon.API_PARTS.data.r,
                    data:{
                        "api_key":countlyGlobal.member.api_key,
                        "app_id":countlyCommon.ACTIVE_APP_ID,
                        "method":"networkerror",
                        "period":_period,
                        "group":id,
                        "display_loader": !isRefresh
                    },
                    dataType:"jsonp",
                    success:function (json) {
                        _groupData = json;
                    }, 
                    error:function(jqXHR, textStatus, errorThrown ){
                        if(errorThrown && errorThrown === "Bad Request"){
                            CountlyHelpers.alert(jQuery.i18n.map["crashes.not-found"], "red");
                            app.navigate("/crashes", true);
                        }
                    }
                });
            }
           
		}else{
            if (!countlyCommon.DEBUG) {
                _activeAppKey = countlyCommon.ACTIVE_APP_KEY;
                _initialized = true;
    
                return $.when(
                    $.ajax({
                        type:"GET",
                        url:countlyCommon.API_PARTS.data.r,
                        data:{
                            "api_key":countlyGlobal.member.api_key,
                            "app_id":countlyCommon.ACTIVE_APP_ID,
                            "method":"get_network_segments",
                            "period":_period
                        },
                        dataType:"jsonp",
                        success:function (json) {
                            if(json && json.segments){
                                for(var i = 0; i < json.segments.length; i++){
                                    json.segments[i] = countlyCommon.decode(json.segments[i]);
                                }
                                _segments = json.segments;
                                _domains = json.domains;
                            }
                        }
                    }),
                    $.ajax({
                        type:"GET",
                        url:countlyCommon.API_PARTS.data.r,
                        data:{
                            "api_key":countlyGlobal.member.api_key,
                            "app_id":countlyCommon.ACTIVE_APP_ID,
                            "method":_name,
                            "segmentation": _segment,
                            "period":_period
                        },
                        dataType:"jsonp",
                        success:function (json) {
                            countlyNetwork.setDb(json);
                        }
                    })
                ).then(function(){
                    return true;
                });
            } else {
                _Db = {"2012":{}};
                return true;
            }
        }

        
    };

    countlyNetwork.getGroupData = function () {
		return _groupData;
    };

    function setMeta() {
        if (_crashTimeline['meta']) {
			for(var i in _crashTimeline['meta']){
				_metas[i] = (_crashTimeline['meta'][i]) ? _crashTimeline['meta'][i] : [];
			}
        }
    }

    countlyNetwork.refresh = function (id) {
        _periodObj = countlyCommon.periodObj;

        if (!countlyCommon.DEBUG) {

            if (_activeAppKey != countlyCommon.ACTIVE_APP_KEY) {
                _activeAppKey = countlyCommon.ACTIVE_APP_KEY;
                return this.initialize();
            }
            
            if(!_initialized)
                return this.initialize();

                _period = countlyCommon.getPeriodForAjax();
                if(id){
                    if(id=='metrics'){
                        return $.ajax({
                            type:"GET",
                            url:countlyCommon.API_PARTS.data.r,
                            data:{
                                "api_key":countlyGlobal.member.api_key,
                                "app_id":countlyCommon.ACTIVE_APP_ID,
                                "period":_period,
                                "method":"metrics",
                                "graph":1,
                                "display_loader": false
                            },
                            dataType:"jsonp",
                            success:function (json) {
                                _crashData = json;
                                if(_crashData.crashes.latest_version == "")
                                    _crashData.crashes.latest_version = "None";
                                if(_crashData.crashes.error == "")
                                    _crashData.crashes.error = "None";
                                if(_crashData.crashes.os == "")
                                    _crashData.crashes.os = "None";
                                if(_crashData.crashes.highest_app == "")
                                    _crashData.crashes.highest_app = "None";
                                
                                countlyCommon.extendDbObj(_crashTimeline, json.data);
                            }
                        });
                    }else{
                        return $.ajax({
                            type:"GET",
                            url:countlyCommon.API_PARTS.data.r,
                            data:{
                                "api_key":countlyGlobal.member.api_key,
                                "app_id":countlyCommon.ACTIVE_APP_ID,
                                "method":"networkerror",
                                "period":_period,
                                "group":id,
                                "display_loader": false
                            },
                            dataType:"jsonp",
                            success:function (json) {
                                _groupData = json;
                                if(_groupData.data && _groupData.data.length){
                                    for(var i = 0; i < _groupData.data.length; i++){
                                        _reportData[_groupData.data[i]._id] = _groupData.data[i]; 
                                    }
                                }
                                _list[_groupData._id] = _groupData.name;
                                _groupData.dp = {};
                                for(var i in _metrics){
                                    if(_groupData[i]){
                                        _usable_metrics.metrics[i] = _metrics[i];
                                        _groupData.dp[i] = countlyNetwork.processMetric(_groupData[i], i, _metrics[i]);
                                    }
                                }
                                if(_groupData.custom){
                                    for(var i in _groupData.custom){
                                        _groupData.dp[i] = countlyNetwork.processMetric(_groupData.custom[i], i, i);
                                        _usable_metrics.custom[i] = i.charAt(0).toUpperCase() + i.slice(1);
                                    }
                                }
                            }
                        });
                    }
                    
                }

            return $.when(
                $.ajax({
                    type:"GET",
                    url:countlyCommon.API_PARTS.data.r,
                    data:{
                        "api_key":countlyGlobal.member.api_key,
                        "app_id":countlyCommon.ACTIVE_APP_ID,
                        "method":"get_network_segments",
                        "period":_period,
                        "display_loader": false
                    },
                    dataType:"jsonp",
                    success:function (json) {
                        if(json && json.segments){
                            for(var i = 0; i < json.segments.length; i++){
                                json.segments[i] = countlyCommon.decode(json.segments[i]);
                            }
                            _segments = json.segments;
                            _domains = json.domains;
                        }
                    }
                }),
                $.ajax({
                    type:"GET",
                    url:countlyCommon.API_PARTS.data.r,
                    data:{
                        "api_key":countlyGlobal.member.api_key,
                        "app_id":countlyCommon.ACTIVE_APP_ID,
                        "method":_name,
                        "segmentation": _segment,
                        "action":"refresh"
                    },
                    dataType:"jsonp",
                    success:function (json) {
                        countlyNetwork.extendDb(json);
                    }
                })
            ).then(function(){
                return true;
            });
        } else {
            _Db = {"2012":{}};

            return true;
        }
    };

    countlyNetwork.processMetric = function (data, metric, label) {
        
		var ret = {dp:[{data:[[-1,null]], "label":label}],ticks:[[-1,""]]};
		if(data){
            var vals = [];
			for(var key in data){
                vals.push({key:key, val:data[key]});
            }
            vals.sort(function(a,b){
                return b.val - a.val;
            });
            for(var i = 0; i < vals.length; i++){
				ret.dp[0].data.push([i,vals[i].val]);
                var l = vals[i].key.replace(/:/g, '.');
                if(metric == "device" && countlyDeviceList && countlyDeviceList[l])
                    l = countlyDeviceList[l];
				ret.ticks.push([i,l]);
			}
			ret.dp[0].data.push([vals.length,null]);
		}
		return ret;
    };


    countlyNetwork._reset = countlyNetwork.reset;
    countlyNetwork.reset = function () {
        _actionData = {};
        _segment = null;
        _initialized = false;
        _segments = [];
        _domains = [];
        countlyNetwork._reset();
    };
    
    countlyNetwork.setSegment = function(segment){
        _segment = countlyCommon.decode(segment);
    };
    
    countlyNetwork.getSegments = function(){
        return _segments;
    };
    
    countlyNetwork.getDomains = function(){
        return _domains;
    };
    
    countlyNetwork.loadActionsData = function (view) {
        _period = countlyCommon.getPeriodForAjax();

        return $.when(
            $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r,
                data:{
                    "api_key":countlyGlobal.member.api_key,
                    "app_id":countlyCommon.ACTIVE_APP_ID,
                    "method":"get_network_segments",
                    "period":_period
                },
                dataType:"jsonp",
                success:function (json) {
                    if(json && json.segments){
                        for(var i = 0; i < json.segments.length; i++){
                            json.segments[i] = countlyCommon.decode(json.segments[i]);
                        }
                        _segments = json.segments;
                    }
                }
            }),
            $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r+"/actions",
                data:{
                    "api_key":countlyGlobal.member.api_key,
                    "app_id":countlyCommon.ACTIVE_APP_ID,
                    "view":view,
                    "segment": _segment,
                    "period":_period
                },
                dataType:"json",
                success:function (json) {
                    _actionData = json;
                }
            })
        ).then(function(){
            return true;
        });
    };
    
    countlyNetwork.testUrl = function(url, callback){
        $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r+"/urltest",
            data:{
                "url":url
            },
            dataType:"json",
            success:function (json) {
                if(callback)
                    callback(json.result);
            }
        });
    };
    
    countlyNetwork.getToken = function(callback){
        $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r+"/token",
            data:{
                "api_key":countlyGlobal.member.api_key,
                "app_id":countlyCommon.ACTIVE_APP_ID
            },
            dataType:"json",
            success:function (json) {
                if(callback)
                    callback(json.result);
            },
            error: function(){
                if(callback)
                    callback(false);
            }
        });
    };
    
    countlyNetwork.getActionsData = function (view) {
        return _actionData;
    };
    
    countlyNetwork.getChartData = function(path, metric, name){
        var chartData = [
                { data:[], label:name, color:'#DDDDDD', mode:"ghost" },
                { data:[], label:name, color:'#333933' }
            ],
            dataProps = [
                {
                    name:"p"+metric,
                    func:function (dataObj) {
                        return dataObj[metric]
                    },
                    period:"previous"
                },
                { name:metric}
            ];

        return countlyCommon.extractChartData(countlyNetwork.getDb(), countlyNetwork.clearObject, chartData, dataProps, countlyCommon.encode(path));
    };

    countlyNetwork.getData = function (clean) {
	
        var chartData = countlyCommon.extractTwoLevelData(countlyNetwork.getDb(), countlyNetwork.getMeta(), countlyNetwork.clearObject, [
            {
                name:_name,
                func:function (rangeArr, dataObj) {
                    return countlyCommon.decode(rangeArr);
                }
            },
            { "name":"u" },
            { "name":"t" },
            { "name":"s" },
            { "name":"b" },
            { "name":"e" },
            { "name":"d" },
            { "name":"n" }
        ]);

        chartData.chartData = countlyCommon.mergeMetricsByName(chartData.chartData, _name);

        return chartData;
    };
    
    countlyNetwork.getMetricsData = function (){
        return _crashData;
    }
    countlyNetwork.getDashboardData = function () {
        console.log("_crashTimeline", _crashTimeline);
        var data = countlyCommon.getDashboardData(_crashTimeline, ["cr", "crnf", "crf", "cru", "crru"], [], null, countlyNetwork.clearMetricsObject);
        console.log("dashborad data", data);
        return {usage:data,period:_period};
    };
    countlyNetwork.getMetricsChartData = function(metric, name){
		var chartData = [
                { data:[], label:name, color:'#DDDDDD', mode:"ghost" },
                { data:[], label:name, color:'#333933' }
            ],
            dataProps = [
                {
                    name:"p"+metric,
                    func:function (dataObj) {
                        return dataObj[metric]
                    },
                    period:"previous"
                },
                { name:metric }
            ];

        return countlyCommon.extractChartData(_crashTimeline, countlyNetwork.clearMetricsObject, chartData, dataProps);
    };
    
    countlyNetwork.clearObject = function (obj) {
        if (obj) {
            if (!obj["u"]) obj["u"] = 0;
            if (!obj["t"]) obj["t"] = 0;
            if (!obj["n"]) obj["n"] = 0;
            if (!obj["s"]) obj["s"] = 0;
            if (!obj["e"]) obj["e"] = 0;
            if (!obj["b"]) obj["b"] = 0;
            if (!obj["d"]) obj["d"] = 0;
        }
        else {
            obj = {"u":0, "t":0, "n":0, "s":0, "e":0, "b":0, "d":0};
        }
        return obj;
    };


    
    countlyNetwork.clearMetricsObject = function (obj) {
        if (obj) {
            if (!obj["cr"]) obj["cr"] = 0;
            if (!obj["cru"]) obj["cru"] = 0;
            if (!obj["crnf"]) obj["crnf"] = 0;
            if (!obj["crf"]) obj["crf"] = 0;
            
            if (!obj["crru"]) obj["crru"] = 0;
        }
        else {
            obj = {"cr":0, "cru":0, "crnf":0, "crf":0, "crru":0};
        }

        return obj;
    };
    
    countlyNetwork.getViewFrequencyData = function () {
        var _Db = countlyNetwork.getDb();
        countlyNetwork.setDb(countlySession.getDb());
        
        var data = countlyNetwork.getRangeData("vc", "v-ranges", countlyNetwork.explainFrequencyRange);
        
        countlyNetwork.setDb(_Db);
        
        return data;
    };
    
    var getRange = function(){
        var visits = jQuery.i18n.map["network.visits"].toLowerCase();
        return [
            "1 - 2 " + visits,
            "3 - 5 " + visits,
            "6 - 10 " + visits,
            "11 - 15 " + visits,
            "16 - 30 " + visits,
            "31 - 50 " + visits,
            "51 - 100 " + visits,
            "> 100 " + visits
        ];
    };
    
    countlyNetwork.explainFrequencyRange = function (index) {
        return getRange()[index];
    };

    countlyNetwork.getFrequencyIndex = function (value) {
        return getRange().indexOf(value);
    };

})();
