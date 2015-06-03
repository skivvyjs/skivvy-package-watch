'use strict';

var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var rewire = require('rewire');
var EventEmitter = require('events').EventEmitter;

chai.use(sinonChai);

describe('task:watch', function() {
	var task;
	var mockApi = createMockApi();
	var mockChokidar = createMockChokidar();
	before(function() {
		task = rewire('../../lib/tasks/watch');
		task.__set__('chokidar', mockChokidar);
	});

	afterEach(function() {
		mockChokidar.reset();
		mockApi.reset();
	});

	function createMockApi() {
		return {
			errors: {
				TaskError: createCustomError('TaskError')
			},
			utils: {
				log: {
					info: sinon.spy(function(message) {}),
					error: sinon.spy(function(message) {})
				},
				colors: {
					path: function(string) { return '<path>' + string + '</path>'; }
				}
			},
			run: sinon.spy(function(options, callback) {
				setTimeout(function() {
					if (options.task === 'error') {
						callback(new Error('Task error'));
					} else {
						callback(null);
					}
				});
			}),
			reset: function() {
				this.run.reset();
				this.utils.log.info.reset();
				this.utils.log.error.reset();
			}
		};

		function createCustomError(type) {
			function CustomError(message) {
				this.message = message;
			}

			CustomError.prototype = Object.create(Error.prototype);
			CustomError.prototype.name = type;

			return CustomError;
		}
	}

	function createMockChokidar() {
		var chokidar = {
			watch: sinon.spy(function(files, options) {
				var instance = new EventEmitter();
				var on = instance.on;
				instance.on = sinon.spy(function(event, listener) {
					on.call(instance, event, listener);
				});
				this.instance = instance;
				return instance;
			}),
			instance: null,
			reset: function() {
				this.instance = null;
				this.watch.reset();
			}
		};
		return chokidar;
	}

	it('should have a description', function() {
		expect(task.description).to.be.a('string');
	});

	it('should specify default configuration', function() {
		expect(task.defaults).to.eql({});
	});

	it('should throw an error if no files are specified', function() {
		var results = [
			function() { task.call(mockApi, {}); },
			function() { task.call(mockApi, { files: undefined }); },
			function() { task.call(mockApi, { files: null }); },
			function() { task.call(mockApi, { files: false }); },
			function() { task.call(mockApi, { files: '' }); }
		];
		results.forEach(function(result) {
			expect(result).to.throw(mockApi.errors.TaskError);
			expect(result).to.throw('No files');
		});
	});

	it('should throw an error if no task is specified', function() {
		var results = [
			function() { task.call(mockApi, { files: 'src/*' }); },
			function() { task.call(mockApi, { files: 'src/*', task: undefined }); },
			function() { task.call(mockApi, { files: 'src/*', task: null }); },
			function() { task.call(mockApi, { files: 'src/*', task: false }); },
			function() { task.call(mockApi, { files: 'src/*', task: '' }); }
		];
		results.forEach(function(result) {
			expect(result).to.throw(mockApi.errors.TaskError);
			expect(result).to.throw('No task');
		});
	});

	it('should call chokidar watch method and attach listeners', function() {
		var watcher = task.call(mockApi, {
			files: '/project/src/**/*',
			task: 'build',
			options: {
				foo: 'bar'
			}
		});

		expect(watcher).to.exist;
		expect(watcher).to.equal(mockChokidar.instance);
		expect(mockChokidar.watch).to.have.been.calledOnce;
		expect(mockChokidar.watch).to.have.been.calledWith(
			'/project/src/**/*',
			{
				foo: 'bar'
			}
		);

		expect(watcher.on).to.have.been.calledTwice;
		expect(watcher.on).to.have.been.calledWith('error');
		expect(watcher.on).to.have.been.calledWith('ready');
		watcher.on.reset();

		watcher.emit('ready');

		expect(watcher.on).to.have.been.calledThrice;
		expect(watcher.on).to.have.been.calledWith('add');
		expect(watcher.on).to.have.been.calledWith('change');
		expect(watcher.on).to.have.been.calledWith('unlink');
	});

	it('should attach listeners for custom events', function() {
		var watcher = task.call(mockApi, {
			files: '/project/src/**/*',
			task: 'build',
			events: ['addDir', 'unlinkDir']
		});

		expect(watcher.on.callCount).to.equal(2);
		expect(watcher.on).to.have.been.calledWith('error');
		expect(watcher.on).to.have.been.calledWith('ready');
		watcher.on.reset();

		watcher.emit('ready');

		expect(watcher.on).to.have.been.calledTwice;
		expect(watcher.on).to.have.been.calledWith('addDir');
		expect(watcher.on).to.have.been.calledWith('unlinkDir');
	});

	it('should run task when files are changed', function() {
		var watcher = task.call(mockApi, {
			files: '/project/src/**/*',
			task: 'build',
			events: ['change']
		});

		watcher.emit('ready');

		expect(mockApi.run).not.to.have.been.called;

		watcher.emit('change');

		expect(mockApi.run).to.have.been.calledOnce;
		expect(mockApi.run).to.have.been.calledWith({
			task: 'build'
		});
	});

	it('should allow task sequences', function(done) {
		var watcher = task.call(mockApi, {
			files: '/project/src/**/*',
			task: ['build', 'deploy'],
			events: ['change']
		});

		watcher.emit('ready');

		expect(mockApi.run).not.to.have.been.called;

		watcher.emit('change');

		expect(mockApi.run).to.have.been.calledOnce;
		expect(mockApi.run).to.have.been.calledWith({
			task: 'build'
		});

		setTimeout(function() {
			expect(mockApi.run).to.have.been.calledTwice;
			expect(mockApi.run).to.have.been.calledWith({
				task: 'deploy'
			});
			done();
		});
	});

	it('should throttle repeated events', function(done) {
		var watcher = task.call(mockApi, {
			files: '/project/src/**/*',
			task: 'build',
			events: ['change'],
			debounce: 50
		});

		watcher.emit('ready');

		expect(mockApi.run).not.to.have.been.called;

		watcher.emit('change');
		watcher.emit('change');
		watcher.emit('change');

		setTimeout(function() {
			expect(mockApi.run).to.have.been.calledOnce;
			expect(mockApi.run).to.have.been.calledWith({
				task: 'build'
			});
			mockApi.run.reset();

			watcher.emit('change');
			watcher.emit('change');
			watcher.emit('change');

			setTimeout(function() {
				expect(mockApi.run).to.have.been.calledOnce;
				expect(mockApi.run).to.have.been.calledWith({
					task: 'build'
				});
				done();
			}, 50);
		}, 50);
	});

	describe('logging', function() {
		it('should show message when ready', function() {
			var watcher = task.call(mockApi, {
				files: '/project/src/**/*',
				task: 'build'
			});

			expect(mockApi.utils.log.info).not.to.have.been.called;

			watcher.emit('ready');

			expect(mockApi.utils.log.info).to.have.been.calledOnce;
			expect(mockApi.utils.log.info).to.have.been.calledWith('Watching for changes...');
		});

		it('should log file changes', function() {
			var watcher = task.call(mockApi, {
				files: '/project/src/**/*',
				task: 'build',
				events: ['add', 'change', 'unlink', 'addDir', 'unlinkDir']
			});

			watcher.emit('ready');

			mockApi.utils.log.info.reset();

			watcher.emit('add', '/project/src/add');
			watcher.emit('change', '/project/src/change');
			watcher.emit('unlink', '/project/src/unlink');
			watcher.emit('addDir', '/project/src/addDir');
			watcher.emit('unlinkDir', '/project/src/unlinkDir');

			var expectedMessages = [
				'File added: <path>/project/src/add</path>',
				'File updated: <path>/project/src/change</path>',
				'File removed: <path>/project/src/unlink</path>',
				'Directory added: <path>/project/src/addDir</path>',
				'Directory removed: <path>/project/src/unlinkDir</path>'
			];
			expect(mockApi.utils.log.info.callCount).to.equal(expectedMessages.length);
			expectedMessages.forEach(function(message) {
				expect(mockApi.utils.log.info).to.have.been.calledWith(message);
			});
		});

		it.only('should log file changes (throttled)', function(done) {
			var watcher = task.call(mockApi, {
				files: '/project/src/**/*',
				task: 'build',
				events: ['add', 'change', 'unlink', 'addDir', 'unlinkDir'],
				debounce: 1
			});

			watcher.emit('ready');

			// First batch
			testAsyncEvents(function() {
				// Second batch
				testAsyncEvents(function() {
					done();
				}, 2);
			}, 2);


			function testAsyncEvents(callback, delay) {
				mockApi.utils.log.info.reset();

				watcher.emit('add', '/project/src/add');
				watcher.emit('change', '/project/src/change');
				watcher.emit('unlink', '/project/src/unlink');
				watcher.emit('addDir', '/project/src/addDir');
				watcher.emit('unlinkDir', '/project/src/unlinkDir');

				expect(mockApi.utils.log.info).not.to.have.been.called;

				setTimeout(function() {
					expect(mockApi.utils.log.info.args).to.eql([
						['File added: <path>/project/src/add</path>'],
						['File updated: <path>/project/src/change</path>'],
						['File removed: <path>/project/src/unlink</path>'],
						['Directory added: <path>/project/src/addDir</path>'],
						['Directory removed: <path>/project/src/unlinkDir</path>']
					]);
					callback();
				}, delay);
			}
		});

		it('should log errors if task fails', function(done) {
			var watcher = task.call(mockApi, {
				files: '/project/src/**/*',
				task: 'error',
				events: ['change']
			});

			watcher.emit('ready');

			expect(mockApi.utils.log.error).not.to.have.been.called;

			watcher.emit('change');

			setTimeout(function() {
				expect(mockApi.utils.log.error).to.have.been.calledOnce;
				expect(mockApi.utils.log.error.firstCall.args.length).to.equal(1);
				expect(mockApi.utils.log.error.firstCall.args[0]).to.be.an.instanceof(Error);
				expect(mockApi.utils.log.error.firstCall.args[0].message).to.contain('Task error');
				done();
			});
		});

		it('should log chokidar errors', function() {
			var watcher = task.call(mockApi, {
				files: '/project/src/**/*',
				task: 'build'
			});

			expect(mockApi.utils.log.error).not.to.have.been.called;

			var watchError = new Error('Watch error');

			watcher.emit('error', watchError);

			expect(mockApi.utils.log.error).to.have.been.calledOnce;
			expect(mockApi.utils.log.error.firstCall.args).to.eql([
				watchError
			]);
		});
	});
});
