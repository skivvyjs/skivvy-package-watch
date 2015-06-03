# Skivvy package: `watch`
[![npm version](https://img.shields.io/npm/v/@skivvy/skivvy-package-watch.svg)](https://www.npmjs.com/package/@skivvy/skivvy-package-watch)
![Stability](https://img.shields.io/badge/stability-stable-brightgreen.svg)
[![Build Status](https://travis-ci.org/skivvyjs/skivvy-package-watch.svg?branch=master)](https://travis-ci.org/skivvyjs/skivvy-package-watch)

> Watch files and folders for changes


## Installation

```bash
skivvy install watch
```


## Overview

This package allows you to watch files and folders for changes from within the [Skivvy](https://www.npmjs.com/package/skivvy) task runner.


## Included tasks

### `watch`

Watch files and folders using [chokidar](https://www.npmjs.com/package/chokidar), and run Skivvy tasks when files are changed.

#### Usage:

```bash
skivvy run watch
```


#### Configuration settings:

| Name | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |
| `files` | `string` `Array<string>` | Yes | N/A | Files and folders to watch (can contain globs) |
| `task` | `string` `object` `function` `Array<string,object,function>` | Yes | N/A | Skivvy task(s) to run when files are changed |
| `debounce` | `number` | No | `0` | Batch multiple changes that occur within `debounce` milliseconds of each other |
| `events` | `Array<string>` | No | `["add", "change", "unlink"]` | [Chokidar events](https://www.npmjs.com/package/chokidar#methods-events) to listen for |
| `options` | `object` | No | `null` | [Chokidar options](https://www.npmjs.com/package/chokidar#persistence) |

#### Notes:

- The `task` configuration setting will be passed directly as the `task` option to Skivvy's [`api.run()`](https://github.com/skivvyjs/skivvy/blob/master/docs/api.md#api.run) method.

	This means that the following examples are all valid values for the `task` configuration setting:

	```json
	"my-local-task"
	```

	```json
	"my-local-task:custom-target"
	```

	```json
	"my-package::external-task"
	```

	```json
	"my-package::external-task:custom-target"
	```

	```json
	{ "task": "my-local-task", "config": { "foo": "bar" } }
	```

	```json
	{ "task": "my-package::external-task", "config": { "foo": "bar" } }
	```

	```json
	[
		"my-local-task",
		"my-package::external-task:custom-target",
		{ "task": "my-local-task", "config": { "foo": "bar" } },
		{ "task": "my-package::external-task", "config": { "foo": "bar" } }
	]
	```

#### Returns:

`Watcher` Chokidar instance, returned from [chokidar.watch](https://www.npmjs.com/package/chokidar#api)
