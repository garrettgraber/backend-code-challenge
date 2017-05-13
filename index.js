'use strict';

const parser = require('xml2json');
const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const Promise = require('bluebird');
const request = Promise.promisify(require("request"), {multiArgs: true});
Promise.promisifyAll(request, {multiArgs: true});

const serverPort = 8100;
const app = express();

app.use(bodyParser.json());

app.get('/v1/api/term/:tid/longest-preview-media-url', function(req, res, next) {

	// console.log("Param sent: ", req.params);

	const PreviewMediaPromise = findLongestPreviewMedia(req.params.tid);

	PreviewMediaPromise.then(function(response) {

		// console.log("response in then: ", response);
	
		res.json(response);

	}).catch(function(error) {

		// console.log("error in endpoint: ", error);

		let errorStatusCodeArray = error.toString().split(':');
		let errorStatusCodeString = errorStatusCodeArray[ errorStatusCodeArray.length - 1 ];
		let httpErrorCode = parseInt(errorStatusCodeString);

		// console.log("httpErrorCode: ", httpErrorCode);

		if(httpErrorCode >= 200) {

			res.sendStatus(httpErrorCode);

		} else {

			res.json({
				message: "Information Response",
				code: httpErrorCode
			});

		}

	});

});


app.listen(serverPort, function () {

	console.log('Backend code challenge app listening on port http://localhost:' +  serverPort);

});


function apiCall(endPointType, tempId) {

    return request.getAsync(apiCallOptions(endPointType, tempId)).then(function(response) {

    	// console.log("status code: ", response[0].statusCode);
    	// console.log("response in getAsync: ", turnResponseToJSObject(response[1]) );

    	if( parseInt(turnResponseToJSObject(response[1]).response.totalCount) === 0 ) {

	    	response[0].statusCode = 404;

    	}

    	// response[0].statusCode = 418;

    	if(response[0].statusCode === 200) {

    		return turnResponseToJSObject(response[1]);

    	} else {

    		throw new Error('HTTP Error:' + response[0].statusCode);

    	}

    });

};


function apiCallOptions(endPointType, tempId) {

	const ApiUrlBase = {
		vocabulary: 'http://d6api.gaia.com/vocabulary/1/',
		videos: 'http://d6api.gaia.com/videos/term/',
		media: 'http://d6api.gaia.com/media/'
	};

    return {
        url: ApiUrlBase[endPointType] + tempId,
        method: "GET",
        headers: {
            'Content-Type': 'application/json'
        }
    };

};


function findLongestPreviewMedia(tempTid) {

	const ResultObject = {
		bcHLS: '',
		titleNid: 0,
		previewNid: 0,
		previewDuration: 0
	};

	return apiCall('vocabulary', tempTid).then(function(vocabularyResult, error) {

		// console.log("vocabularyResult: ", vocabularyResult);
		// console.log("vocabulary error: ", error);

		const firstTermTid = getVocabularyDataTid(vocabularyResult);
		ResultObject.titleNid = parseInt(firstTermTid);

		return apiCall('videos', firstTermTid);

	}).then(function(videoResult, error) {

		// console.log("videoResult: ", videoResult);
		// console.log("video error: ", error);

		const LongestDurationObject = getVideoData(videoResult);
		const longestDurationNid = LongestDurationObject.previewNid;

		ResultObject.previewNid = parseInt(longestDurationNid);
		ResultObject.previewDuration = parseInt(LongestDurationObject.previewDuration);

		return apiCall('media', longestDurationNid);

	}).then(function(mediaResult, error) {

		// console.log("mediaResult: ", mediaResult);
		// console.log("media error: ", error);

		const mediaUrl = getMediaUrl(mediaResult);

		ResultObject.bcHLS = mediaUrl;

	}).return(ResultObject).catch(function(error) {

		// console.log("error: ", error);

		throw error;

	});

};


function getVocabularyDataTid(dataResponse) {

	return dataResponse.response.terms.term[0].tid;

};


function getVideoData(dataResponse) {

	const videoTitleArray = dataResponse.response.titles.title;
	const videoArrayHasPreview = videoTitleArray.filter(function(obj) {
	    return obj.hasOwnProperty('preview');
	});

	const TitleWithLongestDuration = _.maxBy(videoArrayHasPreview, function(o) { 
		return parseFloat(o.preview.duration);
	});

	// console.log("TitleWithLongestDuration: ", TitleWithLongestDuration);

	const longestDurationValue = Math.max.apply(Math, videoArrayHasPreview.map(function(o){
		return parseFloat(o.preview.duration);
	}));

	const longestDurationNid = TitleWithLongestDuration.preview.nid;

	// console.log("longestDurationValue: ", longestDurationValue);
	// console.log("videoArrayHasPreview.length: ", videoArrayHasPreview.length);
	// console.log("videoTitleArray.length: ", videoTitleArray.length);

	// const durationMatch = (parseFloat(TitleWithLongestDuration.preview.duration) === longestDurationValue)? true : false;

	// console.log("Duration Match: ", durationMatch);

	return {
		previewNid: longestDurationNid,
		previewDuration: TitleWithLongestDuration.preview.duration
	};

};


function getMediaUrl(dataResponse) {

	return dataResponse.response.mediaUrls.bcHLS;

};


function turnResponseToJSObject(tempResponse) {

	return JSON.parse(parser.toJson(tempResponse));

};

