window.NetworkView = countlyView.extend({
    selectedMetric:"t",
    selectedView:null,
    selectedViews:[],
	selectedApps: {all:true},
	selectedCount: 0,
    ids:{},
    lastId:0,
    token: false,
    useView: null,
    beforeRender: function() {
			var self = this;
			return $.when($.get(countlyGlobal["path"]+'/network/templates/network.html', function(src){
				self.template = Handlebars.compile(src);
			}), countlyNetwork.initialize()).then(function () {});
    },
    getProperties: function(metric){
        return {
            "t":jQuery.i18n.map["network.http.request-cnts"],
            "d":jQuery.i18n.map["network.http.response-time"],
            "e":jQuery.i18n.map["network.http.error-cnts"],
            // "n":jQuery.i18n.map["network.http.response-time"],
        //    "s":jQuery.i18n.map["views.starts"],
        //    "e":jQuery.i18n.map["views.exits"],
        //    "b":jQuery.i18n.map["views.bounces"] 
        }
    },
    renderCommon:function (isRefresh) {
        var self = this;
        var data = countlyNetwork.getData();
        var props = this.getProperties();
        var usage = [];
        for(var i in props){
            usage.push({
                    "title":props[i],
                    "id":"view-metric-"+i
                });
        }
        
        var domains = countlyNetwork.getDomains();
        for(var i = 0; i < domains.length; i++){
            domains[i] = countlyCommon.decode(domains[i]);
        }

        this.templateData = {
            "page-title":jQuery.i18n.map["network.title"],
            "font-logo-class":"fa-eye",
            "active-segmentation": jQuery.i18n.map["network.all-segments"],
            "segmentations": countlyNetwork.getSegments(),
            "usage":usage,
            "domains":domains
        };

        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));
            
            var columns = [
                { "mData": function(row, type){if(type == "display"){ return row.network+"<div class='color'></div>";} else return row.network;}, sType:"string", "sTitle": jQuery.i18n.map["network.table.url"] , "sClass": "break", "sWidth": "30%"},
                { "mData": "t", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["network.http.request-cnts"] },
                { "mData": "d", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["network.http.response-time"] },
                { "mData": function(row, type){
                    var time = (row.d == 0 || row.t == 0) ? 0 : (row.d/row.t).toFixed(2);
                    return time;
                     // if(type === "display")
                    //  return countlyCommon.timeString(time/1000);
                    // else return time
                }, sType:"numeric", "sTitle": jQuery.i18n.map["network.avg-duration"] },
                { "mData": function(row, type){
                    if(row.e > 0){
                        return "<p id='"+row.network+"' class='table-link green link-class'>" +countlyCommon.formatNumber(row.e)+ "</a>";
                    }else{
                        return 0;
                    }
                }, sType:"numeric", "sTitle": jQuery.i18n.map["network.http.error-cnts"] },
                { "mData": function(row, type){
                    var rate = (row.e == 0 ) ? 0 : (row.e/row.t*100).toFixed(2);
                    return rate+"%";
                  
                }, sType:"string", "sTitle": jQuery.i18n.map["network.error-rate"] },
                // { "mData": "e", sType:"formatted-num", "mRender":function(d) { return "<p id='"+row.network+"' class='table-link green link-class'>" +countlyCommon.formatNumber(d)+ "</a>"; }, "sTitle": jQuery.i18n.map["network.http.error-cnts"] }
            //    { "mData": "s", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["network.starts"] },
            //    { "mData": "e", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["network.exits"] },
            //    { "mData": "b", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["network.bounces"] }
            ];
            
            if(typeof addDrill != "undefined"){
                $(".widget-header .left .title").after(addDrill("sg.name", null, "[CLY]_network"));
                if(countlyGlobal["apps"][countlyCommon.ACTIVE_APP_ID].type == "web" && domains.length){
                    columns.push({ "mData": function(row, type){
                        var url = "#/analytics/network/action-map/";
                        if(countlyGlobal['apps'][countlyCommon.ACTIVE_APP_ID]["app_domain"] && countlyGlobal['apps'][countlyCommon.ACTIVE_APP_ID]["app_domain"].length > 0){
                            url = countlyGlobal['apps'][countlyCommon.ACTIVE_APP_ID]["app_domain"];
                            if(url.indexOf("http") !== 0)
                                url = "http://"+url;
                            if(url.substr(url.length - 1) == '/') 
                                url = url.substr(0, url.length - 1);
                        }

                        return '<a href='+url+row.network+' class="table-link green" data-localize="network.table.view" style="margin:0px; padding:2px;">'+jQuery.i18n.map["network.table.view"]+'</a>';
                        }, sType:"string", "sTitle": jQuery.i18n.map["network.action-map"], "sClass":"shrink center", bSortable: false });
                }
            }

            this.dtable = $('.d-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaData": data.chartData,
                "fnRowCallback": function( nRow, aData, iDisplayIndex, iDisplayIndexFull ) {
                    if(!self.selectedView){
                        self.selectedView = aData.network;
                        self.selectedViews.push(self.selectedView);
                    }
                    
                    if(!self.ids[aData.network]){
                        self.ids[aData.network] = "view_"+self.lastId;
                        self.lastId++;
                    }
                    $(nRow).attr("id", self.ids[aData.network]);
                   
                },
                "aoColumns": columns
            }));
            $('.link-class').on("click", function (event){
                event.stopPropagation();
                var id =countlyCommon.hex_md5($(this).attr("id"));
                if(id){
                    var link = "#/analytics/networkerror/" + id ;
                    window.open(link, "_self");
                } 
                event.preventDefault();
            });
            $(".d-table").stickyTableHeaders();
            this.dtable.fnSort( [ [1,'desc'] ] );
            $(".dataTable-bottom").append("<div class='dataTables_info' style='float: right;'>"+jQuery.i18n.map["network.maximum-items"]+" ("+countlyCommon.GRAPH_COLORS.length+")</div>")
            
            $('.views-table tbody').on("click", "tr", function (event){
                var row = $(this);
                
                self.selectedView = row.find("td").first().text();

                var persistentSettings = countlyCommon.getPersistentSettings()["pageNetworkItems_" + countlyCommon.ACTIVE_APP_ID] || [];

                if(_.contains(self.selectedViews, self.selectedView)){
                    var index = self.selectedViews.indexOf(self.selectedView);
                    self.selectedViews.splice(index, 1);
                    persistentSettings.splice(persistentSettings.indexOf(self.selectedView), 1);
                    row.find(".color").css("background-color", "transparent");
                }
                else if(self.selectedViews.length < countlyCommon.GRAPH_COLORS.length){
                    self.selectedViews.push(self.selectedView);
                    persistentSettings.push(self.selectedView);
                }
                
                var persistData = {};
                persistData["pageNetworkItems_" + countlyCommon.ACTIVE_APP_ID] = persistentSettings;
                countlyCommon.setPersistentSettings(persistData);

                if(self.selectedViews.length == 0)
                    $("#empty-graph").show();
                else
                    $("#empty-graph").hide();
                self.drawGraph();
            });
            
            $('.views-table tbody').on("click", "a.table-link", function (event){
                event.stopPropagation();
                var followLink = false;
                var url = event.target.href;

                if(url.indexOf("#/analytics/network/action-map/") < 0){
                    followLink = true;
                }

                if(countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].sdk_version && parseInt((countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].sdk_version+"").split(".")[0]) <= 16){
                    return;
                }
                $(event.target).toggleClass("active");
                if($(event.target).hasClass("active")){
                    $(".views-table a.table-link").removeClass("active");
                    $(event.target).addClass("active");
                    
                    if(!followLink){
                        var pos = $(event.target).offset();
                        $('.widget-content .cly-button-menu').css({
                            top: (pos.top+25) + "px",
                            left: (pos.left-250) + "px",
                            right: 35 + "px"
                        });
                        $('.widget-content > .cly-button-menu-trigger').addClass("active");
                        $('.widget-content > .cly-button-menu').focus();
                    }

                    var newWindow = "";
                    if(followLink){
                        newWindow = window.open("");
                    }

                    countlyNetwork.getToken(function(token){
                        self.useView = event.target.hash;
                        self.token = token;

                        if(followLink && (self.token !== false)){
                            newWindow.location.href = url;
                            newWindow.name = "cly:" + JSON.stringify({"token":self.token,"purpose":"heatmap",period:countlyCommon.getPeriodForAjax(),showHeatMap: true});    
                        }
                    });
                }
                else{
                    $(event.target).removeClass("active");
                    $('.widget-content > .cly-button-menu-trigger').removeClass("active");
                }
                event.preventDefault();
            });
            
            $('.widget-content .cly-button-menu .item').click(function(event){
                var url = $(event.target).text();
                if(url.indexOf("http") !== 0)
                    url = "http://"+url;
                if(url.substr(url.length - 1) == '/') {
                    url = url.substr(0, url.length - 1);
                }
                if(self.token !== false){
                    var path = self.useView.replace("#/analytics/network/action-map/", "");
                    window.open(url+path, "cly:" + JSON.stringify({"token":self.token,"purpose":"heatmap",period:countlyCommon.getPeriodForAjax(),showHeatMap: true}));
                }
                $('.widget-content > .cly-button-menu-trigger').removeClass("active");
            });

            $('.widget-content .cly-button-menu').blur(function() {
                $('.widget-content > .cly-button-menu-trigger').removeClass("active");
            });
            
            $("#view-metric-"+this.selectedMetric).parents(".big-numbers").addClass("active");
            
            $(".widget-content .inner").click(function () {
                $(".big-numbers").removeClass("active");
                $(".big-numbers .select").removeClass("selected");
                $(this).parent(".big-numbers").addClass("active");
                $(this).find('.select').addClass("selected");
            });
            
            $(".segmentation-option").on("click", function () {
                countlyNetwork.reset();
				countlyNetwork.setSegment($(this).data("value"));
                self.refresh();
			});
    
            $(".big-numbers .inner").click(function () {
                var elID = $(this).find('.select').attr("id").replace("view-metric-", "");
    
                if (self.selectedMetric == elID) {
                    return true;
                }
    
                self.selectedMetric = elID;
                self.drawGraph();
            });
            
            var persistentSettings = countlyCommon.getPersistentSettings()['pageViewsItems_' + countlyCommon.ACTIVE_APP_ID] || [];
            if(persistentSettings.length === 0){
                for(var i in self.selectedViews){
                    persistentSettings.push(self.selectedViews[i]);
                }

                var persistData = {};
                persistData["pageViewsItems_" + countlyCommon.ACTIVE_APP_ID] = persistentSettings;
                countlyCommon.setPersistentSettings(persistData);
            }else{
                self.selectedViews = [];
                
                for(var i in persistentSettings){
                    var current = persistentSettings[i];

                    if(self.selectedViews.indexOf(current) < 0)
                        self.selectedViews.push(current)
                }
            }

            $("#view-metric-"+this.selectedMetric).parents(".big-numbers").addClass("active");
            
            this.drawGraph();
        }
    },
    drawGraph: function(){
        var props = this.getProperties();
        var dp = [];
        // console.log("selectedViews="+this.selectedViews.length);
        for(var i = 0;  i < this.selectedViews.length; i++){
            var color = countlyCommon.GRAPH_COLORS[i];
            var data = countlyNetwork.getChartData(this.selectedViews[i], this.selectedMetric, props[this.selectedMetric]).chartDP;
            data[1].color = color;
            $("#"+this.ids[this.selectedViews[i]]+" .color").css("background-color", color);
            if(this.selectedViews.length == 1){
                var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
                data[0].color = "rgba("+parseInt(result[1], 16)+","+parseInt(result[2], 16)+","+parseInt(result[3], 16)+",0.5"+")";
                dp.push(data[0])
            }
            dp.push(data[1]);
        }
        countlyCommon.drawTimeGraph(dp, "#dashboard-graph");
    },
    refresh:function () {
        var self = this;
        $.when(countlyNetwork.refresh()).then(function () {
            if (app.activeView != self) {
                return false;
            }
            console.log("come into select time with period="+countlyCommon.getPeriodForAjax());
            self.renderCommon(true);

            newPage = $("<div>" + self.template(self.templateData) + "</div>");
        
            $(self.el).find(".dashboard-summary").replaceWith(newPage.find(".dashboard-summary"));

            var data = countlyNetwork.getData();
            CountlyHelpers.refreshTable(self.dtable, data.chartData);
            $('.link-class').on("click", function (event){
                event.stopPropagation();
                var id =countlyCommon.hex_md5($(this).attr("id"));
                if(id){
                    var link = "#/analytics/networkerror/" + id ;
                    window.open(link, "_self");
                } 
                event.preventDefault();
            });
            self.drawGraph();
        });
    }
});

window.NetworkFrequencyView = countlyView.extend({
    beforeRender: function() {
        return $.when(countlySession.initialize()).then(function () {});
    },
    renderCommon:function (isRefresh) {
        var durationData = countlyNetwork.getViewFrequencyData();

        this.templateData = {
            "page-title":jQuery.i18n.map["network.view-frequency"],
            "font-logo-class":"fa-eye"
        };

        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));

            countlyCommon.drawGraph(durationData.chartDP, "#dashboard-graph", "bar");

            this.dtable = $('.d-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaData": durationData.chartData,
                "aoColumns": [
                    { "mData": "vc", sType:"view-frequency", "sTitle": jQuery.i18n.map["network.view-frequency"] },
                    { "mData": "t", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["common.number-of-sessions"] },
                    { "mData": "percent", "sType":"percent", "sTitle": jQuery.i18n.map["common.percent"] }
                ]
            }));

            $(".d-table").stickyTableHeaders();
            
        }
    },
    refresh:function () {
        var self = this;
        $.when(countlySession.initialize()).then(function () {
            if (app.activeView != self) {
                return false;
            }

            var durationData = countlyNetwork.getViewFrequencyData();
            countlyCommon.drawGraph(durationData.chartDP, "#dashboard-graph", "bar");
            CountlyHelpers.refreshTable(self.dtable, durationData.chartData);
        });
    }
});

window.ActionMapView = countlyView.extend({
    actionType: "",
    curSegment: 0,
    curRadius: 1,
    curBlur: 1,
    baseRadius: 1,
    baseBlur: 1.6,
    beforeRender: function() {
        var self = this;
        return $.when($.get(countlyGlobal["path"]+'/network/templates/actionmap.html', function(src){
			self.template = Handlebars.compile(src);
		}), countlyNetwork.loadActionsData(this.view)).then(function () {});
    },
    getData: function(data){
        var heat = [];
        var point;
        var width = $("#view-canvas-map").prop('width');
        var height = $("#view-canvas-map").prop('height');
        for(var i = 0; i < data.length; i++){
            point = data[i].sg;
            if(point.type == this.actionType)
                heat.push([parseInt((point.x/point.width)*width), parseInt((point.y/point.height)*height), data[i].c])
        }
        return heat;
    },
    getMaxHeight: function(data){
        var width = $("#view-map").width();
        var lowest = {w:0, h:0};
        var highest = {w:100000, h:5000};
        for(var i = 0; i < data.length; i++){
            if(width == data[i].sg.width)
                return data[i].sg.height;
            else if(width > data[i].sg.width && lowest.w < data[i].sg.width){
                lowest.w = data[i].sg.width;
                lowest.h = data[i].sg.height;
            }
        }

        if(lowest.h > 0)
            return lowest.h;
        
        for(var i = 0; i < data.length; i++){
            if(width < data[i].sg.width && highest.w > data[i].sg.width){
                highest.w = data[i].sg.width;
                highest.h = data[i].sg.height;
            }
        }
        
        return highest.h;
    },
    getResolutions: function(data){
        var res = ["Normal", "Fullscreen", "320x480","480x800"];
        return res;
    },
    resize: function(){
        $('#view-canvas-map').prop('width', $("#view-map").width());
        $('#view-canvas-map').prop('height', $("#view-map").height());
        if(this.map)
            this.map.resize();
    },
    loadIframe: function(){
        var self = this;
        var segments = countlyNetwork.getActionsData().domains;
        var url = "http://"+segments[self.curSegment]+self.view;
        if($("#view_loaded_url").val().length == 0)
            $("#view_loaded_url").val(url);
        countlyNetwork.testUrl(url, function(result){
            if(result){
                $("#view-map iframe").attr("src", url);
                $("#view_loaded_url").val(url);
            }
            else{
                self.curSegment++;
                if(segments[self.curSegment]){
                    self.loadIframe();
                }
                else{
                    $("#view_loaded_url").show();
                    CountlyHelpers.alert(jQuery.i18n.map["network.cannot-load"], "red");
                }
            }
        });
    },
    renderCommon:function (isRefresh) {
        var data = countlyNetwork.getActionsData();
        this.actionType = data.types[0] || jQuery.i18n.map["network.select-action-type"];
        var segments = countlyNetwork.getSegments();
        var self = this;
        this.templateData = {
            "page-title":jQuery.i18n.map["network.action-map"],
            "font-logo-class":"fa-eye",
            "first-type":this.actionType,
            "active-segmentation": jQuery.i18n.map["network.all-segments"],
            "segmentations": segments,
            "resolutions": this.getResolutions(),
            "data":data
        };

        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));
            $("#view-map").height(this.getMaxHeight(data.data));
            this.resize();
            this.loadIframe();
            this.map = simpleheat("view-canvas-map");
            this.map.data(this.getData(data.data));
            this.baseRadius = Math.max((48500-35*data.data.length)/900, 5);
            this.drawMap();

            app.localize();

            $("#view_reload_url").on("click", function () {
				$("#view-map iframe").attr("src", "/o/urlload?url="+encodeURIComponent($("#view_loaded_url").val()));
			});
            
            $("#view_loaded_url").keyup(function(event){
                if(event.keyCode == 13){
                    $("#view_reload_url").click();
                }
            });
            
            $("#radius").on("change", function(){
                self.curRadius = parseInt($("#radius").val())/10;
                self.drawMap();
            });
            
            $("#blur").on("change", function(){
                self.curBlur = parseInt($("#blur").val())/10;
                self.drawMap();
            });
            
            $("#action-map-type .segmentation-option").on("click", function () {
				self.actionType = $(this).data("value");
                self.refresh();
			});
            
            $("#action-map-resolution .segmentation-option").on("click", function () {
                switch ($(this).data("value")) {
                    case "Normal":
                        $("#view-map").width("100%");
                        $("#view-map").prependTo("#view-map-container");
                        break;
                    case "Fullscreen":
                        $("#view-map").width("100%");
                        $("#view-map").prependTo(document.body);
                        break;
                    default:
                        var parts = $(this).data("value").split("x");
                        $("#view-map").width(parts[0]+"px");
                        $("#view-map").prependTo("#view-map-container");
                }
				self.resize();
                self.refresh();
			});
            
            $("#view-segments .segmentation-option").on("click", function () {
                countlyNetwork.reset();
				countlyNetwork.setSegment($(this).data("value"));
                self.refresh();
			});
        }
    },
    drawMap:function(){
        this.map.radius(this.baseRadius*this.curRadius, this.baseRadius*this.baseBlur*this.curBlur);
        this.map.draw();
    },
    refresh:function () {
        var self = this;
        $.when(countlyNetwork.loadActionsData(this.view)).then(function () {
            if (app.activeView != self) {
                return false;
            }
            self.renderCommon(true);
            var data = countlyNetwork.getActionsData();
            if(self.map){
                self.map.clear();
                self.map.data(self.getData(data.data));
                self.baseRadius = Math.max((48500-35*data.data.length)/900, 5);
                self.drawMap();
            }
        });
    }
});



window.NetworkErrorView = countlyView.extend({
	initialize:function () {
        this.loaded = true;
    },
    beforeRender: function() {
        countlyNetwork.reset();
		// if(this.template)
		// 	return $.when(countlyNetwork.initialize(this.id)).then(function () {});
		// else{
			var self = this;
			return $.when($.get(countlyGlobal["path"]+'/network/templates/networkerror.html', function(src){
				self.template = Handlebars.compile(src);
			}), countlyNetwork.initialize(this.id)).then(function () {});
		// }
    },
    renderCommon:function (isRefresh) {
        var crashData = countlyNetwork.getGroupData();
        var url = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '')+countlyGlobal["path"]+"/crash/";
       
        if(crashData.url)
               url += crashData.url;
        crashData.latest_version="12:03";
		crashData.latest_version = crashData.latest_version.replace(/:/g, '.');
        
        this.comments = {};
        
        if(typeof marked != "undefined"){
            marked.setOptions({
                breaks: true
            });
        }
        
        this.templateData = {
            "page-title":jQuery.i18n.map["crashes.crashes-by"],
            "note-placeholder": jQuery.i18n.map["crashes.editnote"],
            "hasPermission": (countlyGlobal["member"].global_admin || countlyGlobal["admin_apps"][countlyCommon.ACTIVE_APP_ID]) ? true : false,
            "url":url,
			"data":crashData,
			// "error":crashData[0].name.substr(0, 80),
            // "fatal": (crashData[0].nonfatal) ? jQuery.i18n.map["crashes.nonfatal"] : jQuery.i18n.map["crashes.fatal"],
			"active-segmentation": this.curTitle,
			"segmentations": this.metrics,
        };

		var self = this;
        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));
			this.dtable = $('.d-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaSorting": [[0,'desc']],
                "aaData": crashData || [],
				"fnRowCallback": function( nRow, aData, iDisplayIndex, iDisplayIndexFull ) {
					$(nRow).attr("id", aData._id);
				},
                "aoColumns": [
                    { "mData": function(row, type){if(type == "display") return countlyCommon.formatTimeAgo(row.ts); else return row.ts;}, "sType":"format-ago", "sTitle": jQuery.i18n.map["error.time"]},
                    // { "mData": function(row, type){return row.url;}, "sType":"string", "sTitle": jQuery.i18n.map["network.table.url"] },
                    // { "mData": function(row, type){return row.name;}, "sType":"string", "sTitle": jQuery.i18n.map["error.name"] },
                    { "mData": function(row, type){return row.code;}, "sType":"numeric", "sTitle": jQuery.i18n.map["error.code"] },
					{ "mData": function(row, type){var str = row.os; if(row.os_version) str += " "+row.os_version.replace(/:/g, '.'); return str;}, "sType":"string", "sTitle": jQuery.i18n.map["crashes.os_version"] },
					{ "mData": function(row, type){var str = ""; if(row.manufacture) str += row.manufacture+" "; if(row.device) str += countlyDeviceList[row.device] || row.device; return str;}, "sType":"string", "sTitle": jQuery.i18n.map["crashes.device"]},
					{ "mData": function(row, type){return row.app_version.replace(/:/g, '.');}, "sType":"string", "sTitle": jQuery.i18n.map["crashes.app_version"] }
                ]
            }));
			this.dtable.stickyTableHeaders();
			
			/*$('.crash-reports tbody').on("click", "tr", function (){
				var id = $(this).attr("id");
				if(id)
					window.location.hash = window.location.hash.toString()+"/"+id;
			});*/
			CountlyHelpers.expandRows(this.dtable, this.formatData);
			// countlyCommon.drawGraph(crashData.dp[this.curMetric], "#dashboard-graph", "bar");
 
         
            $(".btn-share-crash").click(function(e){
				if ($(this).hasClass("active")) {
                    $(this).removeClass("active");
                    $("#crash-share-list").hide();
                }
                else{
                    $(this).addClass("active");
                    $("#crash-share-list").show();
                }
			});

            $("#share-crash-done").click(function() {
                $(".btn-share-crash").removeClass("active");
                $("#crash-share-list").hide();
            }); 
            
            if(crashData.is_public){
                $('#crash-share-public').attr('checked', true);
                $(".crash-share").show();
            }
            else{
                $('#crash-share-public').attr('checked', false);
                $(".crash-share").hide();
            }
            
            if(crashData.share){
                for(var i in crashData.share){
                    if(crashData.share[i])
                        $('#crash-share-'+i).attr('checked', true);
                }
            }
          
            
            $( "#tabs" ).tabs({
                select: function( event, ui ) {
                    $(".flot-text").hide().show(0);
                }
            });
            $( "#crash-notes" ).click(function(){
                var crashData = countlyNetwork.getGroupData();
                if(crashData.comments){
                    for(var i = 0; i < crashData.comments.length; i++){
                        store.set("countly_"+self.id+"_"+crashData.comments[i]._id, true);
                    }
                    $(".crash-comment-count").hide();
                }
            });
           

            $("#expand-crash").on("click", function() {
                $(this).toggleClass("active");
                $("#expandable").toggleClass("collapsed");
            });

            var errorHeight = $("#expandable").find("code").outerHeight();

            if (errorHeight < 200) {
                $("#expandable").removeClass("collapsed");
                $("#expand-crash").hide();
            } else {
                $("#expandable").addClass("collapsed");
                $("#expand-crash").show();
            }
        }

        $("document").ready(function() {
            self.redecorateStacktrace();
        });
        
        var self = this;
        
    },
    redecorateStacktrace:function(){
         $(".crash-stack .line-number").remove();
         $(".crash-stack .cl").remove();
        
    },
    refresh:function () {
        var self = this;
        if(this.loaded){
            this.loaded = false;
            $.when(countlyNetwork.initialize(this.id, true)).then(function () {
                self.loaded = true;
                if (app.activeView != self) {
                    return false;
                }
                self.renderCommon(true);
                var newPage = $("<div>" + self.template(self.templateData) + "</div>");
                $("#big-numbers-container").replaceWith(newPage.find("#big-numbers-container"));
                $(".grouped-numbers").replaceWith(newPage.find(".grouped-numbers"));
                $(".crash-bars").replaceWith(newPage.find(".crash-bars"));

                var crashData = countlyNetwork.getGroupData();
                $("#error pre code").html(crashData.error);
                var errorHeight = $("#expandable").find("code").outerHeight();

                if (errorHeight < 200) {
                    $("#expandable").removeClass("collapsed");
                    $("#expand-crash").hide();
                } else {
                    if($('#expand-crash:visible').length == 0){
                        $("#expandable").addClass("collapsed");
                        $("#expand-crash").show();
                    }
                }

                self.redecorateStacktrace();
                if(crashData.comments){
                    var container = $("#comments");
                    var comment, parent;
                    var count = 0;
                    for(var i = 0; i < crashData.comments.length; i++){
                        self.comments[crashData.comments[i]._id] = crashData.comments[i].text;
                        comment = crashData.comments[i];
                        if(container.find("#comment_"+comment._id).length){
                            parent = container.find("#comment_"+comment._id);
                            parent.find(".text").html(newPage.find("#comment_"+comment._id+" .text").html());
                            parent.find(".author").html(newPage.find("#comment_"+comment._id+" .author").html());
                            parent.find(".time").html(newPage.find("#comment_"+comment._id+" .time").html());
                        }
                        else
                            container.append(newPage.find("#comment_"+comment._id));
                        
                        if(!crashData.comments[i].is_owner && typeof store.get("countly_"+self.id+"_"+comment._id) == "undefined"){
                            count++;
                        }
                    }
                    if(count > 0){
                        $(".crash-comment-count span").text(count+"");
                        $(".crash-comment-count").show();
                    }
                }
                CountlyHelpers.refreshTable(self.dtable, crashData);
                // countlyCommon.drawGraph(crashData.dp[self.curMetric], "#dashboard-graph", "bar");
                CountlyHelpers.reopenRows(self.dtable, self.formatData);
                app.localize();
            });
        }
    },
	formatData: function( data ) {
		// `d` is the original data object for the row
		var str = '';
		if(data){
			str += '<div class="datatablesubrow">'+
				'<table style="width: 100%;">'+
						'<tr>'+
							'<td class="text-left">'+jQuery.i18n.map["crashes.app_version"]+'</td>'+
							'<td class="text-left">'+jQuery.i18n.map["crashes.device"]+'</td>'+
							'<td class="text-left">'+jQuery.i18n.map["crashes.state"]+'</td>';
                            if(data.custom)
                                str += '<td class="text-left">'+jQuery.i18n.map["crashes.custom"]+'</td>';
						str += '</tr>'+
						'<tr>'+
							'<td class="text-left">'+data.app_version.replace(/:/g, '.')+'</td>'+
							'<td class="text-left">'+data.os+' ';
                                if(data.os_version)
                                    str += data.os_version.replace(/:/g, '.')+'<br/>';
                                if(data.manufacture)
                                    str += data.manufacture;+' ';
                                if(data.device)
                                    str += data.device;
                                if(data.cpu)
                                    str += ' ('+data.cpu+')';
				str += '<br/>';
                                if(data.opengl)
                                    str += jQuery.i18n.map["crashes.opengl"]+': '+data.opengl+'<br/>';
                                if(data.resolution)
                                    str += jQuery.i18n.map["crashes.resolution"]+': '+data.resolution+'<br/>';
                                str += jQuery.i18n.map["crashes.root"]+': '+((data.root)? "yes" : "no")+'<br/>';
                            str += '</td>'+
                            '<td class="text-left">';
                                if(data.ram_current && data.ram_total)
                                    str += jQuery.i18n.map["crashes.ram"]+': '+data.ram_current+'/'+data.ram_total+' Mb<br/>';
                                if(data.disk_current && data.disk_total)
                                    str += jQuery.i18n.map["crashes.disk"]+': '+data.disk_current+'/'+data.disk_total+' Mb<br/>';
                                if(data.bat_current)
                                    str += jQuery.i18n.map["crashes.battery"]+': '+data.bat_current+'%<br/>';
                                if(data.run)
                                    str += jQuery.i18n.map["crashes.run"]+': '+countlyCommon.timeString(data.run/60)+'<br/>';
                                if(data.session)
                                    str += jQuery.i18n.map["crashes.after"]+' '+data.session+' '+jQuery.i18n.map["crashes.sessions"]+'<br/>';
                                else
                                    str += jQuery.i18n.map["crashes.frequency"]+': '+jQuery.i18n.map["crashes.first-crash"]+'<br/>';
                                str += jQuery.i18n.map["crashes.online"]+": "+((data.online)? "yes" : "no")+"<br/>";
                                str += jQuery.i18n.map["crashes.background"]+": "+((data.background)? "yes" : "no")+"<br/>";
                                str += jQuery.i18n.map["crashes.muted"]+": "+((data.muted)? "yes" : "no")+"<br/>";
                            str += '</td>';
                            if(data.custom){
                                str += '<td class="text-left">';
                                for(var i in data.custom){
                                    str += i+': '+data.custom[i]+'<br/>';
                                }
                                str += '</td>';
                            }
						str += '</tr>'+
                        '<tr>'+
                        '<td colspan="4" class="stack-trace">';
                        str += '<pre>' + data.error + '</pre></td>'+
						'</tr>';
                        if(data.logs){
                            str += '<tr>'+
                                '<td class="text-left">'+jQuery.i18n.map["crashes.logs"]+'</td>'+
                            '</tr>'+
                            '<tr>'+
                            '<td colspan="4">'+
                                '<pre>' + data.logs + '</pre></td>'+
                            '</tr>';
                        }
						str += '</table>'+
			'</div>';
		}
		return str;
	},
	switchMetric:function(metric){
		this.curMetric = metric;
		var crashData = countlyNetwork.getGroupData();
		countlyCommon.drawGraph(crashData.dp[this.curMetric], "#dashboard-graph", "bar");
	}
});



window.NetworkMetricView = countlyView.extend({
    convertFilter: {
        "sg.crash":{prop:"_id", type:"string"},
        "sg.cpu":{prop:"cpu", type:"segment"},
        "sg.opengl":{prop:"opengl", type:"segment"},
        "sg.os":{prop:"os", type:"string"},
        "sg.orientation":{prop:"orientation", type:"segment"},
        "sg.nonfatal":{prop:"nonfatal", type:"booltype"},
        "sg.root":{prop:"root", type:"boolsegment"},
        "sg.online":{prop:"online", type:"boolsegment"},
        "sg.signal":{prop:"signal", type:"boolsegment"},
        "sg.muted":{prop:"muted", type:"boolsegment"},
        "sg.background":{prop:"background", type:"boolsegment"},
        "up.d":{prop:"device", type:"segment"},
        "up.pv":{prop:"os_version", type:"segment"},
        "up.av":{prop:"app_version", type:"segment"},
        "up.r":{prop:"resolution", type:"segment"},
        "up.ls":{prop:"lastTs", type:"date"},
        "up.fs":{prop:"startTs", type:"date"},
        "is_new":{prop:"is_new", type:"booltype"},
        "is_resolved":{prop:"is_resolved", type:"booltype"},
        "is_hidden":{prop:"is_hidden", type:"booltype"},
        "is_renewed":{prop:"is_renewed", type:"booltype"},
        "reports":{prop:"reports", type:"number"},
        "users":{prop:"reports", type:"number"},
        "ram_min":{prop:"ram.min", type:"number"},
        "ram_max":{prop:"ram.max", type:"number"},
        "bat_min":{prop:"bat.min", type:"number"},
        "bat_max":{prop:"bat.max", type:"number"},
        "disk_min":{prop:"disk.min", type:"number"},
        "disk_max":{prop:"disk.max", type:"number"},
        "run_min":{prop:"run.min", type:"number"},
        "run_max":{prop:"run.max", type:"number"}
    },
	initialize:function () {
        this.loaded = true;
		this.filter = (store.get("countly_crashfilter")) ? store.get("countly_crashfilter") : "crash-all";
        this.curMetric = "cr";
        this.metrics = {
			cr:jQuery.i18n.map["network.total-visits"],
			cru:jQuery.i18n.map["network.http.error-cnts"],
			crnf:jQuery.i18n.map["network.http.restime"],
            crf:jQuery.i18n.map["network.http.bytes"],
            crru:jQuery.i18n.map["network.http.reportcnts"]
			// crru:jQuery.i18n.map["crashes.resolved-users"]
		};
    },
    beforeRender: function() {
        this.selectedCrashes = {};
        this.selectedCrashesIds = [];
		if(this.template)
			return $.when(countlyNetwork.initialize(this.id)).then(function () {});
		else{
			var self = this;
			return $.when($.get(countlyGlobal["path"]+'/network/templates/metrics.html', function(src){
				self.template = Handlebars.compile(src);
			}), countlyNetwork.initialize(this.id)).then(function () {});
		}
    },
    
    renderCommon:function (isRefresh) {
        var crashData = countlyNetwork.getMetricsData();
        var chartData = countlyNetwork.getMetricsChartData(this.curMetric, this.metrics[this.curMetric]);
        var dashboard = countlyNetwork.getDashboardData();
        var avarage_time = (dashboard.usage['crnf'].total/(dashboard.usage['cr'].total-dashboard.usage['cru'].total)).toFixed(1);
        if(isNaN(avarage_time)){
            avarage_time = 0;
        }
        dashboard.usage['crnf'].total = 0;
        var avarage_bytes = (dashboard.usage['crf'].total/((dashboard.usage['cr'].total-dashboard.usage['cru'].total))).toFixed(1);
        if(isNaN(avarage_bytes)){
            avarage_bytes = 0;
        }
        dashboard.usage['crf'].total = avarage_bytes; 
        
        // console.log("period="+countlyCommon.getPeriodForAjax());
        var throughput_v = 0;
        if('hour'==countlyCommon.getPeriodForAjax() || 'yesterday'==countlyCommon.getPeriodForAjax()){
            throughput_v = dashboard.usage['cr'].total;
        }else if('month'==countlyCommon.getPeriodForAjax()){
            throughput_v = (dashboard.usage['cr'].total/(365*24)).toFixed(1);
        }else if('day'==countlyCommon.getPeriodForAjax()){
            throughput_v = (dashboard.usage['cr'].total/(30*24)).toFixed(1);
        }else if('7days'==countlyCommon.getPeriodForAjax()){
            throughput_v = (dashboard.usage['cr'].total/(7*24)).toFixed(1);
        }else if('30days'==countlyCommon.getPeriodForAjax()){
            throughput_v = (dashboard.usage['cr'].total/(30*24)).toFixed(1);
        }else if('60days'==countlyCommon.getPeriodForAjax()){
            throughput_v = (dashboard.usage['cr'].total/(60*24)).toFixed(1);
        }
        // (dashboard.usage['cr'].total/((dashboard.usage['cr'].total-dashboard.usage['cru'].total))).toFixed(1);
        if(isNaN(throughput_v)){
            throughput_v=0;
        }
        dashboard.usage['crru'].total = throughput_v; 
        // dashboard.usage['crruf'].total = (dashboard.usage['cr'].total/((dashboard.usage['cr'].total-dashboard.usage['cru'].total)*1000)).toFixed(2);
        this.templateData = {
            "page-title":jQuery.i18n.map["network.overview-title"],
            "no-data":jQuery.i18n.map["common.bar.no-data"],
            "usage":[
				{
					"title":jQuery.i18n.map["network.http.request-cnts"],
					"data":dashboard.usage['cr'],
					"id":"crash-cr",
                    "help":"crashes.help-total"
				},
				{
					"title":jQuery.i18n.map["network.http.error-cnts"],
					"data":dashboard.usage['cru'],
					"id":"crash-cru",
                    "help":"crashes.help-unique"
				},
				{
					"title":jQuery.i18n.map["network.http.response-time"],
					"data":dashboard.usage['crnf'],
					"id":"crash-crnf",
                    "help":"crashes.help-nonfatal"
				},
				{
					"title":jQuery.i18n.map["network.http.reportbytes"],
					"data":dashboard.usage['crf'],
					"id":"crash-crf",
                    "help":"crashes.help-fatal"
                }
                // ,
                // {
				// 	"title":jQuery.i18n.map["network.http.reportcnts"],
				// 	"data":dashboard.usage['cnts'],
				// 	"id":"crash-cnts",
                //     "help":"crashes.help-resolved-users"
                // }
                ,
				{
					"title":jQuery.i18n.map["network.http.reportcnts"],
					"data":dashboard.usage['crru'],
					"id":"crash-crru",
                    "help":"crashes.help-resolved-users"
				}
			]
			
        };
        if(crashData.loss){
            this.templateData["loss"] = true;
            this.templateData["big-numbers"]["items"].push({
                "title":jQuery.i18n.map["crashes.loss"],
                "total":crashData.loss.toFixed(2),
                "help":"crashes.help-loss"
            });
        }
		var self = this;
        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));
            $("#total-user-estimate-ind").on("click", function() {
                CountlyHelpers.alert(jQuery.i18n.map["common.estimation"], "black");
            });

            $(".filter-segmentation").clySelectSetSelection(this.filter, jQuery.i18n.map["crashes."+this.filter.split("-").pop()]);
			countlyCommon.drawTimeGraph(chartData.chartDP, "#dashboard-graph");

            $("#crash-"+this.curMetric).parents(".big-numbers").addClass("active");

            $(".widget-content .inner").click(function () {
				$(".big-numbers").removeClass("active");
				$(".big-numbers .select").removeClass("selected");
				$(this).parent(".big-numbers").addClass("active");
				$(this).find('.select').addClass("selected");
			});

            $(".big-numbers .inner").click(function () {
				var elID = $(this).find('.select').attr("id");
                if(elID){
                    if (self.curMetric == elID.replace("crash-", "")) {
                        return true;
                    }
                    self.curMetric = elID.replace("crash-", "");
                    self.switchMetric();
                }
			});
           

            $('.action-segmentation').attr('data-tooltip-content', "#action-segmentation-tooltip");

            $('.action-segmentation').tooltipster({
                theme: ['tooltipster-borderless'],
                contentCloning: false,
                interactive: false,
                trigger: 'hover',
                side: 'left',
                zIndex: 2,
                functionBefore: function() {
                    if (!$('.action-segmentation').hasClass("disabled")) {
                        return false;
                    }
                }
            });
        }
    },
    refresh:function () {
        var self = this;
        if(this.loaded){
            this.loaded = false;
            $.when(countlyNetwork.refresh(this.id)).then(function () {
                self.loaded = true;
                if (app.activeView != self) {
                    return false;
                }
                self.renderCommon(true);
                var newPage = $("<div>" + self.template(self.templateData) + "</div>");

                $(".crashoveral .dashboard").replaceWith(newPage.find(".dashboard"));
                // $(".crash-big-numbers").replaceWith(newPage.find(".crash-big-numbers"));
                // $(".dashboard-summary").replaceWith(newPage.find(".dashboard-summary"));
                
                $("#crash-"+self.curMetric).parents(".big-numbers").addClass("active");
                $(".widget-content .inner").click(function () {
                    $(".big-numbers").removeClass("active");
                    $(".big-numbers .select").removeClass("selected");
                    $(this).parent(".big-numbers").addClass("active");
                    $(this).find('.select').addClass("selected");
                });
                $(".big-numbers .inner").click(function () {
                    var elID = $(this).find('.select').attr("id");
        
                    if (self.curMetric == elID.replace("crash-", "")) {
                        return true;
                    }
        
                    self.curMetric = elID.replace("crash-", "");
                    self.switchMetric();
                });

                // self.dtable.fnDraw(false);
                var chartData = countlyNetwork.getMetricsChartData(self.curMetric, self.metrics[self.curMetric]);
                countlyCommon.drawTimeGraph(chartData.chartDP, "#dashboard-graph");
                //app.localize();
            });
        }
    },
	
    switchMetric:function(){
		var chartData = countlyNetwork.getMetricsChartData(this.curMetric, this.metrics[this.curMetric]);
		countlyCommon.drawTimeGraph(chartData.chartDP, "#dashboard-graph");
	}
});


//register views

app.networkView = new NetworkView();
app.networkFrequencyView = new NetworkFrequencyView();
app.actionMapView = new ActionMapView();
app.networkErrorView = new NetworkErrorView();
app.networkMetricView = new NetworkMetricView();

app.route("/analytics/metrics", 'network', function () {
    this.networkMetricView.id="metrics";
	this.renderWhenReady(this.networkMetricView);
});

app.route("/analytics/network", 'network', function () {
	this.renderWhenReady(this.networkView);
});

app.route("/analytics/networkerror/:id", 'network', function (id) {
    this.networkErrorView.id=id;
	this.renderWhenReady(this.networkErrorView);
});

app.route("/analytics/view-frequency", 'network', function () {
	this.renderWhenReady(this.networkFrequencyView);
});

app.route("/analytics/network/action-map/*view", 'network', function (view) {
    this.actionMapView.view = view;
	this.renderWhenReady(this.actionMapView);
});

app.addPageScript("/drill#", function(){
    var drillClone;
    var self = app.drillView;
    if(countlyGlobal["record_views"]){
        $("#drill-types").append('<div id="drill-type-views" class="item">'+jQuery.i18n.map["network.title"]+'</div>');
        $("#drill-type-views").on("click", function() {
            if ($(this).hasClass("active")) {
                return true;
            }
    
            $("#drill-types").find(".item").removeClass("active");
            $(this).addClass("active");
            $("#event-selector").hide();
    
            $("#drill-no-event").fadeOut();
            $("#segmentation-start").fadeOut().remove();
            $(this).parents(".cly-select").removeClass("dark");
    
            $(".event-select.cly-select").find(".text").text(jQuery.i18n.map["drill.select-event"]);
            $(".event-select.cly-select").find(".text").data("value","");
    
            currEvent = "[CLY]_view";
    
            self.graphType = "line";
            self.graphVal = "times";
            self.filterObj = {};
            self.byVal = "";
            self.drillChartDP = {};
            self.drillChartData = {};
            self.activeSegmentForTable = "";
            countlySegmentation.reset();
    
            $("#drill-navigation").find(".menu[data-open=table-view]").hide();
    
            $.when(countlySegmentation.initialize(currEvent)).then(function () {
                $("#drill").replaceWith(drillClone.clone(true));
                self.adjustFilters();
                self.draw(true, false);
            });
        });
        setTimeout(function() {
            drillClone = $("#drill").clone(true);
        }, 0);
    }
});

$( document ).ready(function() {
    // if(!production){
    //     CountlyHelpers.loadJS("network/javascripts/simpleheat.js");
    // }
    // jQuery.fn.dataTableExt.oSort['view-frequency-asc']  = function(x, y) {
    //     x = countlyNetwork.getFrequencyIndex(x);
    //     y = countlyNetwork.getFrequencyIndex(y);

    //     return ((x < y) ? -1 : ((x > y) ?  1 : 0));
    // };

    // jQuery.fn.dataTableExt.oSort['view-frequency-desc']  = function(x, y) {
    //     x = countlyNetwork.getFrequencyIndex(x);
    //     y = countlyNetwork.getFrequencyIndex(y);

    //     return ((x < y) ?  1 : ((x > y) ? -1 : 0));
    // };
	// var menu = '<a href="#/analytics/network" class="item">'+
	// 	'<div class="logo-icon fa fa-eye"></div>'+
	// 	'<div class="text" data-localize="network.title"></div>'+
	// '</a>';
	// $('#web-type #analytics-submenu').append(menu);
	// $('#mobile-type #analytics-submenu').append(menu);
    
    // var menu = '<a href="#/analytics/view-frequency" class="item">'+
	// 	'<div class="logo-icon fa fa-eye"></div>'+
	// 	'<div class="text" data-localize="views.view-frequency"></div>'+
	// '</a>';
	// $('#web-type #engagement-submenu').append(menu);
	// $('#mobile-type #engagement-submenu').append(menu);
    
    // //check if configuration view exists
    // if(app.configurationsView){
    //     app.configurationsView.registerLabel("network", "network.title");
    //     app.configurationsView.registerLabel("network.view_limit", "network.view-limit");
    // }
    
    var menu = '<a class="item messaging" id="sidebar-messaging">'+
        '<div class="logo ion-chatbox-working"></div>'+
        '<div class="text" data-localize="network.title">网络</div>'+
    '</a>'+
    '<div class="sidebar-submenu" id="messaging-submenu">'+
        '<a href="#/analytics/metrics" class="item">'+
            '<div class="logo-icon fa fa-line-chart"></div>'+
            '<div class="text" data-localize="push.sidebar.overview">概要</div>'+
        '</a>'+
        '<a href="#/analytics/network" class="item">'+
            '<div class="logo-icon fa fa-line-chart"></div>'+
            '<div class="text" data-localize="network.http.overview">HTTP请求</div>'+
        '</a>'+
    '</div>';
   
    if($('#mobile-type #management-menu').length)
        $('#mobile-type #management-menu').before(menu);
    else
        $('#mobile-type').append(menu);
    

});
