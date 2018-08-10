'use strict';
const Promise = require("bluebird");
const utils = require('../parts/utils');
const countlyCommon = require('../../../../api/lib/countly.common.js');
const fetch = require('../../../../api/parts/data/fetch.js');
const countlyModel = require('../../../../api/lib/countly.model.js');
const countlySession = countlyModel.load("users");
const bluebird = require("bluebird");
const moment = require('moment');
const common = require('../../../../api/utils/common.js');
const log = require('../../../../api/utils/log.js')('alert:crash');

const crashAlert = {
	/**
	 * function for sending alert email
	 * @param {*} alertConfigs 
	 * @param {*} result 
	 * @param {*} callback 
	 */
	alert(alertConfigs, result, callback) {
		return bluebird.coroutine(function *() {
			log.i('trigger alert:',result);
			utils.addAlertCount();			
			if (alertConfigs.alertBy === 'email') {
				const emails = yield utils.getDashboardUserEmail(alertConfigs.alertValues)  
				let html = '';
				const host = yield utils.getHost(); 
				
				
				let appsListTitle = 'several apps';
				if(result.length <=3){
					const appName = [];
					result.map((data)=>{ appName.push(data.app.name)});
					appsListTitle = appName.join(', ');
				}
				let title = '';
				if (alertConfigs.alertDataSubType === 'Total crashes') {
					title = `Crash count for ${appsListTitle} has changed compared to yesterday`
				}else if(alertConfigs.alertDataSubType === 'New crash occurence') {
					title = `Received new crashes for ${appsListTitle}`
				}
				const subject = title;
				

				html = yield utils.getEmailTemplate({
					title: `Countly Alert`,
					subTitle: `Countly Alert: ` + alertConfigs.alertName,
					host,
					compareDescribe: alertConfigs.compareDescribe,
					apps: result.map((data)=>{
						const item = {
							id: data.app._id,
							name: data.app.name,
							data:[]
						};
						if(data.todayValue != null){
							item['data'].push({key: 'Today\'s Value', value: data.todayValue});
						}
						if(data.lastDateValue != null){
							item['data'].push({key: 'Yesterday\'s Value', value: data.lastDateValue});
						}
						if(data.errors){
							data.errors.forEach(err => {
								const errorLines = err.error.split('\n');
								let error = '';
								for(let i = 0; i < errorLines.length && i < 4; i++){
									error += errorLines[i] + '<br/>';
								}
								error += `<a href="${host}/dashboard#/${data.app._id}/crashes/${err._id}">Click to view details</a>` + '<br/>'
								item['data'].push({key: error});
							})
						} 
						return item;
					}) 
				})
 				emails.forEach((to) => {
					utils.addAlertCount(to);					
					log.i('will send email=>>>>>>>>>>');
					log.i('to:', to);
					log.d('subject:', subject);
					log.d('message:', html);

					utils.sendEmail(to, subject, html);
				});		
			}

			// if (alertConfigs.alertBy === 'http') {
			// 	utils.sendRequest(alertConfigs.alertValues)
			// }
		})();
		
	},


	/**
	 * alert checking logic.
	 * @param options
	 * @param options.db        database object
	 * @param options.alertConfigs    config for alert
	 * @param options.done      done promise for Countly Job module
	 *
	 */
	check({ db, alertConfigs, done }) {
		const self = this;
		return bluebird.coroutine(function* () {
			log.i("checking alert:", alertConfigs);
			const alertList = [];
			for (let i = 0; i < alertConfigs.selectedApps.length; i++) {
				const currentApp = alertConfigs.selectedApps[i];
				if (alertConfigs.alertDataSubType === 'Total crashes') {
					const rightHour = yield utils.checkAppLocalTimeHour(currentApp, 23);
					if(rightHour) { 
						const result = yield getCrashInfo(currentApp, alertConfigs);
						log.d('app:' + currentApp + ' result:', result);  
						if(result.matched){
							const app = yield utils.getAppInfo(result.currentApp);
							result.app = app;					 
							alertList.push(result);
						}	 
					} 
				}else if(alertConfigs.alertDataSubType === 'New crash occurence') {
					const  result = yield getNewCrashList(currentApp, alertConfigs);
					log.d("getNewCrashList: ",result);
					if(result){
						alertList.push(result);
					}
				}
				
			}
			log.d("alert list:",alertList);
			if(alertList.length > 0) {
				self.alert(alertConfigs, alertList);
			}
			done();
		})();
	}
}


/**
 * function for check new crash in period (5min)
 * @param {string} currentApp  app id
 * @param {object} alertConfigs 
 * @return {object} Promise
 */
function getNewCrashList(currentApp, alertConfigs){
	return new Promise(function( resolve, reject){
		common.db.collection('app_crashgroups' + currentApp).count({},function(err, total) {
			total--;
			log.d(alertConfigs.period,"!!!");
			let unit = 1;
			// switch(alertConfigs.checkPeriod){
			// 	case 'secs': unit = 1; break;
			// 	case 'mins': unit = 60; break;
			// 	case 'hours': unit = 3600; break;
			// }
			// const lastJobTime =  parseInt(new Date().getTime() - 1000 * unit * parseFloat(alertConfigs.checkPeriodValue))/1000;
			
			const lastJobTime =  parseInt(new Date().getTime() - 1000 * 60 * 5)/1000; //check every 5 minutes;

			var cursor = common.db.collection('app_crashgroups' + currentApp).find({is_new:true, startTs:{$gt:lastJobTime}},{uid:1, is_new:1,   name:1, error:1, users:1, startTs:1,lastTs:1});
			cursor.count(function (err, count) {
				cursor.limit(50);
				var ob = {};
				ob['lastTs'] = -1;
				cursor.sort(ob);
				cursor.toArray(function(err, res){
					res = res || [];
					console.log('new Error', res);
					if(res.length > 0){  
						return common.db.collection('apps').findOne({ _id: common.db.ObjectID(currentApp)},function (err, app) {
							const result = {errors: res};
							result.app = app; 
							return resolve(result);
						});
					}
					return resolve(null);
				});
			});
		});
	}).catch(function(e){
		reject(e);
	});
}


/**
 * fetch crash data in last 7 days for compare
 * @param {string} currentApp  app id
 * @param {object} alertConfigs 
 * @return {object} Promise
 */
function getCrashInfo(currentApp, alertConfigs) {
	return new Promise(function (resolve, reject) { 
		return fetch.getTimeObj("crashdata", {
				qstring: { period: '7days' },
				app_id: currentApp
			}, { unique: "cru" }, function (data) {
				const today = new moment();
				const tYear = today.year();
				const tMonth = today.month() + 1;
				const tDate = today.date();
				let todayValue = data[tYear] && data[tYear][tMonth] && data[tYear][tMonth][tDate] && data[tYear][tMonth][tDate]['cr'];
				
				const lastDay = moment().subtract(1, 'days');
				const lYear = lastDay.year();
				const lMonth = lastDay.month() + 1;
				const lDate = lastDay.date();
				let lastDateValue = data[lYear] && data[lYear][lMonth] && data[lYear][lMonth][lDate] && data[lYear][lMonth][lDate]['cr'];
				
				todayValue = todayValue || 0
				lastDateValue =  lastDateValue || 0
				const percentNum = (todayValue / lastDateValue - 1) * 100

				const compareValue = parseFloat(alertConfigs.compareValue);
				const matched = alertConfigs.compareType && alertConfigs.compareType.indexOf('increased') >= 0
					? percentNum > compareValue : percentNum < compareValue;
					
				return resolve({currentApp, todayValue, lastDateValue, matched});
			});
	}).catch((e) => {
		return reject(e);
	});

}
 

module.exports = crashAlert;
