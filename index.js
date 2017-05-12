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

	console.log("Param sent: ", req.params);

	findLongestPreviewMediaUrl(req.params.tid).then(function(response) {

		console.log("response: ", response);
	
		res.json(response);

	});

	// console.log("LongestPreview: ", LongestPreview);

	// request.getAsync(apiCallOptions('media', req.params.tid)).then(function(response) {

		// console.log("response[0].body: ", response[0].body);
		// console.log("response[1]: ", response[1]);

		// const LongestDuration = getVideoData(response[1]);
		// console.log("LongestDuration final: ", LongestDuration);
		// res.json(LongestDuration);

		// const firstTermTid = getVocabularyDataTid(response[1]);
		// console.log("firstTermTid: ", firstTermTid);
		// res.json(firstTermTid);

		// const mediaResponse = response[1];
		// const mediaUrl = getMediaUrl(mediaResponse);
		// console.log("Media url: ", mediaUrl);
		// res.json(mediaUrl);

	// });

});


app.listen(serverPort, function () {

	console.log('Backend code challenge app listening on port http://localhost:' +  serverPort);

});


function apiCall(endPointType, tempId) {

    return request.getAsync(apiCallOptions(endPointType, tempId)).then(function(response) {

    	if(response[0].statusCode === 200) {

    		return turnResponseToJSObject(response[1]);

    	} else {
    		throw new Error('HTTP Error: ' + response.statusCode);
    	}

    });

};


function apiCallOptions(endPointType, tempId) {

	const ApiUrlBase = {
		// vocabulary: 'http://d6api.gaia.com/vocabulary/1/{tid}',
		// videos: 'http://d6api.gaia.com/videos/term/{tid}',
		// media: 'http://d6api.gaia.com/media/{previewNid}'
		vocabulary: 'http://d6api.gaia.com/vocabulary/1/',
		videos: 'http://d6api.gaia.com/videos/term/',
		media: 'http://d6api.gaia.com/media/'
	};

    return {
        url: ApiUrlBase[endPointType] + tempId,
        method: "GET",
        headers: {
            'content-type': 'application/json'
        }
    };

};


function findLongestPreviewMediaUrl(tempTid) {

	const ResultObject = {
		bcHLS: '',
		titleNid: 0,
		previewNid: 0,
		previewDuration: 0
	};

	return apiCall('vocabulary', tempTid).then(function(vocabularyResult) {

		console.log("vocabularyResult: ", vocabularyResult);

		const firstTermTid = getVocabularyDataTid(vocabularyResult);

		ResultObject.titleNid = parseInt(firstTermTid);

		return apiCall('videos', firstTermTid);

	}).then(function(videoResult) {

		console.log("videoResult: ", videoResult);

		const LongestDurationObject = getVideoData(videoResult);
		const longestDurationNid = LongestDurationObject.previewNid;

		ResultObject.previewNid = parseInt(longestDurationNid);
		ResultObject.previewDuration = parseInt(LongestDurationObject.previewDuration);

		return apiCall('media', longestDurationNid);

	}).then(function(mediaResult) {

		console.log("mediaResult: ", mediaResult);

		const mediaUrl = getMediaUrl(mediaResult);

		ResultObject.bcHLS = mediaUrl;

	}).return(ResultObject);

};


function getVocabularyDataTid(dataResponse) {

	return dataResponse.response.terms.term[0].tid;

};


function getVideoData(dataResponse) {

	const videoTitleArray = dataResponse.response.titles.title;
	const videoArrayHasPreview = videoTitleArray.filter(function( obj ) {
	    return obj.hasOwnProperty('preview');
	});

	const TitleWithLongestDuration = _.maxBy(videoArrayHasPreview, function(o) { 
		return parseFloat(o.preview.duration);
	});

	console.log("TitleWithLongestDuration: ", TitleWithLongestDuration);

	const longestDurationValue = Math.max.apply(Math, videoArrayHasPreview.map(function(o){
		return parseFloat(o.preview.duration);
	}));

	const longestDurationNid = TitleWithLongestDuration.preview.nid;

	console.log("longestDurationValue: ", longestDurationValue);
	console.log("videoArrayHasPreview.length: ", videoArrayHasPreview.length);
	console.log("videoTitleArray.length: ", videoTitleArray.length);

	const durationMatch = (parseFloat(TitleWithLongestDuration.preview.duration) === longestDurationValue)? true : false;

	console.log("Duration Match: ", durationMatch);

	return {
		previewNid: longestDurationNid,
		previewDuration: TitleWithLongestDuration.preview.duration
	};

};


function getMediaUrl(dataResponse) {

	const mediaUrl = dataResponse.response.mediaUrls.bcHLS;

	console.log("Media url: ", mediaUrl);

	return mediaUrl;

};


function turnResponseToJSObject(tempResponse) {

	return JSON.parse(parser.toJson(tempResponse));

};
