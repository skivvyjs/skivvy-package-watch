'use strict';

var chokidar = require('chokidar');
var async = require('async');
var debounce = require('lodash.debounce');

module.exports = function(config) {
	var files = config.files || null;
	var task = config.task || null;
	var debounceDelay = config.debounce || 0;
	var events = config.events || ['add', 'change', 'unlink'];
	var watchOptions = config.options || null;
	var api = this;

	if (!files) {
		throw new api.errors.TaskError('No files specified');
	}
	if (!task) {
		throw new api.errors.TaskError('No task specified');
	}

	var watcher = watchFiles(files, events, debounceDelay, watchOptions, function(error, changes) {
		if (error) {
			logError(error);
		} else {
			logChanges(changes);
			runTask(task);
		}

		function logError(error) {
			api.utils.log.error(error);
		}

		function logChanges(changes) {
			changes.forEach(function(change) {
				var label = getChangeLabel(change);
				api.utils.log.info(label + ': ' + api.utils.colors.path(change.path));
			});


			function getChangeLabel(change) {
				switch (change.event) {
					case 'add': return 'File added';
					case 'change': return 'File updated';
					case 'unlink': return 'File removed';
					case 'addDir': return 'Directory added';
					case 'unlinkDir': return 'Directory removed';
				}
			}
		}

		function runTask(task) {
			var tasks = Array.isArray(task) ? task : [task];
			return async.eachSeries(tasks, function(task, callback) {
				api.run({
					task: task
				}, callback);
			}, function(error) {
				if (error) {
					logError(error);
				}
			});
		}
	});

	return watcher;


	function watchFiles(paths, eventNames, debounceDelay, watchOptions, callback) {
		var watcher = chokidar.watch(paths, watchOptions);

		var changes = [];
		var debouncedHandler = getDebouncedHandler(onFilesChanged, debounceDelay);

		watcher.on('error', function(error) {
			callback(error);
		});

		watcher.on('ready', function() {
			eventNames.forEach(function(eventName) {
				watcher.on(eventName, onFileChanged);


				function onFileChanged(path) {
					changes.push({
						event: eventName,
						path: path
					});
					debouncedHandler(changes);
				}
			});

			api.utils.log.info('Watching for changes...');
		});

		return watcher;

		function onFilesChanged(batchedChanges) {
			changes = [];
			callback(null, batchedChanges);
		}

		function getDebouncedHandler(fn, delay) {
			if (!delay) { return fn; }
			return debounce(fn, delay);
		}
	}
};

module.exports.defaults = {
};

module.exports.description = 'Watch files and folders';
