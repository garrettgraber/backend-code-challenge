'use strict';

var parser = require('xml2json');
var _ = require('lodash');
var express = require('express');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
var request = Promise.promisify(require("request"), { multiArgs: true });
Promise.promisifyAll(request, { multiArgs: true });

var app = express();
app.set('port', 8100);

app.use(bodyParser.json());

// Endpoint to hit
app.get('/v1/api/term/:tid/longest-preview-media-url', function (req, res, next) {

	// Promise to find longest preview media
	var PreviewMediaPromise = findLongestPreviewMedia(req.params.tid);

	PreviewMediaPromise.then(function (response) {

		res.json(response);
	}).catch(function (error) {

		// Error parsing
		var errorStatusCodeArray = error.toString().split(':');
		var errorStatusCodeString = errorStatusCodeArray[errorStatusCodeArray.length - 1];
		var httpErrorCode = parseInt(errorStatusCodeString);

		if (httpErrorCode >= 200) {

			res.sendStatus(httpErrorCode);
		} else {

			res.json({
				message: "Information Response",
				code: httpErrorCode
			});
		}
	});
});

app.listen(app.get('port'), function () {

	console.log('Backend code challenge app listening on port http://localhost:' + app.get('port'));
});

// Function that calls the API. Takes an endpoint and an Id
function apiCall(endPointType, tempId) {

	return request.getAsync(apiCallOptions(endPointType, tempId)).then(function (response) {

		if (parseInt(turnResponseToJSObject(response[1]).response.totalCount) === 0) {

			response[0].statusCode = 404;
		}

		// Uncomment the line below to test various errors
		// response[0].statusCode = 418;

		if (response[0].statusCode === 200) {

			return turnResponseToJSObject(response[1]);
		} else {

			throw new Error('HTTP Error:' + response[0].statusCode);
		}
	});
};

// Builds options for the api call, setting the url + id value
function apiCallOptions(endPointType, tempId) {

	var ApiUrlBase = {
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

// Finds the longest preview media.  Promise chain that calls multiple endpoints in succession.
function findLongestPreviewMedia(tempTid) {

	var ResultObject = {
		bcHLS: '',
		titleNid: 0,
		previewNid: 0,
		previewDuration: 0
	};

	// calls vocabulary endpoint
	return apiCall('vocabulary', tempTid).then(function (vocabularyResult, error) {

		// finds the first term id
		var firstTermTid = getVocabularyDataTid(vocabularyResult);
		ResultObject.titleNid = parseInt(firstTermTid);

		// calls the videos endpoint
		return apiCall('videos', firstTermTid);
	}).then(function (videoResult, error) {

		// finds the longest duration video
		var LongestDurationObject = getVideoData(videoResult);
		var longestDurationNid = LongestDurationObject.previewNid;

		ResultObject.previewNid = parseInt(longestDurationNid);
		ResultObject.previewDuration = LongestDurationObject.previewDuration;

		// calls the media endpoint
		return apiCall('media', longestDurationNid);
	}).then(function (mediaResult, error) {

		// gets the media url
		var mediaUrl = getMediaUrl(mediaResult);
		ResultObject.bcHLS = mediaUrl;

		// Returns results. Catches errors.
	}).return(ResultObject).catch(function (error) {

		throw error;
	});
};

// gets the vocabulary title id from the first term
function getVocabularyDataTid(dataResponse) {

	return dataResponse.response.terms.term[0].tid;
};

// gets the video preview with the longest duration and the preview nid
function getVideoData(dataResponse) {

	var videoTitleArray = dataResponse.response.titles.title;
	var videoArrayHasPreview = videoTitleArray.filter(function (obj) {
		return obj.hasOwnProperty('preview');
	});

	var TitleWithLongestDuration = _.maxBy(videoArrayHasPreview, function (o) {
		return parseFloat(o.preview.duration);
	});

	// Extraneous method to find the longest duration of a preview video. Used to check TitleWithLongestDuration.
	var longestDurationValue = Math.max.apply(Math, videoArrayHasPreview.map(function (o) {
		return parseFloat(o.preview.duration);
	}));
	var longestDurationNid = TitleWithLongestDuration.preview.nid;
	var longestDuraionFound = parseFloat(TitleWithLongestDuration.preview.duration);
	var durationCorrect = longestDuraionFound === longestDuraionFound ? true : false;

	console.log("Duration found with two methods is correct: ", durationCorrect);

	return {
		previewNid: longestDurationNid,
		previewDuration: longestDuraionFound
	};
};

// Gets the media url
function getMediaUrl(dataResponse) {

	return dataResponse.response.mediaUrls.bcHLS;
};

// Parses xml to JSON and then to a js object
function turnResponseToJSObject(tempResponse) {

	return JSON.parse(parser.toJson(tempResponse));
};
