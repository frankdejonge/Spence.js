/**
 * Spence
 *
 * An easy way to store API data offline.
 *
 * (c) 2010-2012 Frank de Jonge.
 * Spence may be freely distributed under the MIT license.
 * For all details and documentation:
 * http://spencejs.com
 */

(function (){
	"use strict";

	// Store the context locally.
	var root = this;

	// Store underscore locally.
	var _ = root._;
	if (!_ && (typeof require !== 'undefined')) _ = require('underscore');

	// Store jQuery-ish libs locally
	var $ = root.jQuery || root.Zepto || root.ender;

	// Store JSON locally.
	var JSON = root.JSON;

	// Save the old spence.
	var oldSpence = root.Spence;

	// Timestamp unitity function.
	var time = function () {
		return Math.round(+new Date()/1000);
	};

	// Spence error definition
	function SpenceError(){ Error.apply(this, arguments); }
	SpenceError.prototype = new Error();
	SpenceError.prototype.constructor = SpenceError;
	SpenceError.prototype.name = 'SpenceError';
	root.SpenceError = SpenceError;

	// Spence defaults
	var defaults = {
		// Default succes handler
		success: function (){},
		// Default error handler
		error: function (){},
		// The API url.
		url: false,
		// Api url prefix (domain/app location)
		urlPrefix: '',
		// Avoid key conflict using a unique
		storagePrefix: 'Spence',
		storageSize: 100000, // 2 * 1024 * 1024,
		fetchStack: 'FetchStack',
		engine: ['localDatabase', 'localStorage'],
		data: null,
		dataType: 'json',
		method: 'GET',
		version: '1.0',
		reset: false,
		expiration: false,
		async: true,
		crossDomain: false,
		requestTimeout: 0,
		username: null,
		password: null,
		persistent: true
	};

	// Spence constructor
	var Spence = function (options)
	{
		// Configure the object.
		this.options = _.extend({}, defaults, options || {});

		// set default engine to false
		this.engine = false;

		// Ensure a storage engine.
		this.ensureStorageEngine();
	};

	// Spence noConflict
	Spence.noConflict = function ()
	{
		root.Spence = oldSpence;
		return this;
	};

	// Spence version.
	var Version = Spence.Version = '0.1';

	// Attach constructors to the engines.
	var Engines = Spence.Engines = {
		localDatabase: function (){},
		localStorage: function (){},
		sessionStorage: function (){}
	};

	// define engine utils
	var EngineUtils = {
		// Late constructor.
		init: function ()
		{
			// FetchStack options.
			var options = {
				success: _.bind(function (stack){
					this.fetchStack = stack;
					this.ready();
				}, this),
				error: _.bind(function (){
					this.fetchStack = [];
					this.ready();
				}, this)
			};

			_.defaults(options, this.options);
			this.get(this.options.fetchStack, options);
		},
		// On ready function.
		ready: function (){},
		// Runtime configure method.
		configure: function (options)
		{
			if ( ! _.has(this, 'options'))
			{
				this.options = {};
			}

			_.extend(this.options, options);

			return this;
		},
		// Identifier prefixer.
		prefixIdentifier: function (identifier)
		{
			return this.options.storagePrefix+identifier;
		},
		// Prestorage endorder.
		encode: function (val, options)
		{
			var expiration = options.expiration;

			// Normalize expiration.
			if (expiration !== false)
			{
				expiration = time()+expiration;
			}

			// Stringyfy for storage
			return JSON.stringify({
				expiration: expiration,
				payload: val,
				version: options.version
			});
		},
		// Post retrieve decoder
		decode: function (response, options)
		{
			// Parse the JSON response.
			response = JSON.parse(response);

			// Check wether the resource has expired.
			if (response.expiration !== false && response.expiration < time())
			{
				options.error();
			}

			// Check the version.
			if(response.version !== options.version)
			{
				arguments.length < 2 && this.destroy(response.version);

				// Fire the error callback.
				options.error();
			}

			// Return the response payload.
			options.success(response.payload);
		},
		// Destroy the current session or version
		destroy: function (version)
		{
			var fetchStack = this.fetchStack;

			if ( ! _.isUndefined(version))
			{
				// Retrieve the previous fetchStack.
				fetchStack = this.get(this.options.fetchStack, {version: version}) || [];
			}

			// Delete all the items.
			_.each(this.fetchStack, function (item){
				this.remove(item);
			}, this);

			return this;
		},
		// Delete the last of the fetchStack to free some space.
		deleteLast: function ()
		{
			var last = this.fetchStack.pop();

			return this.remove(last);
		},
		// Store the fetchStack
		saveFetchStack: function ()
		{
			var options = _.extend({
				error: function (){},
				success: function (){
					throw new SpenceError('Could not save the fetchStack to local storage engine.');
				},
				expiration: false
			}, this.options);

			this.fetchStack || (this.fetchStack = []);

			this.set(this.options.fetchStack, this.fetchStack, options);
		},
		getFetchStack: function (callback)
		{
			callback || (callback = function (){});

			this.get(this.options.fetchStack, {
				success: _.bind(function (result){
					this.fetchStack = result;
					callback();
				}, this),
				error: _.bind(function (){
					this.fetchStack = [];
					callback();
				}, this)
			});
		}
	};

	// Attach engine utiles to all drivers.
	for(var util in EngineUtils)
	{
		// attach configure functions
		Engines.localDatabase.prototype[util] = EngineUtils[util];
		Engines.localStorage.prototype[util] = EngineUtils[util];
		Engines.sessionStorage.prototype[util] = EngineUtils[util];
	}

	// LocalStorage driver implementation.
	_.extend(Engines.localStorage.prototype, {
		// Test for localStorage
		test: function ()
		{
			return _.has(root, 'localStorage');
		},
		// Store data in localStorage
		set: function (key, val, options)
		{
			var tries = 0, stored = false;

			// Try up to 5 times, database could be over size
			while(tries < 5 && stored === false)
			{
				try
				{
					// Try to store the data.
					root.localStorage.setItem(
						this.prefixIdentifier(key),
						this.encode(val, options.expiration)
					);

					// The data is now saved.
					stored = true;

					// Add the item to the fetchStack.
					this.fetchStack.push(key);

					// When the data is not the fetchStack
					if (key !== this.options.fetchStack)
					{
						// Store the fetchStack
						this.set(this.options.fetchStack, this.fetchStack, false);
					}
				}
				// Saving the data failed.
				catch(e)
				{
					// Retrieve the last item index.
					var last = this.fetchStack.shift();

					// Remove the last and try again.
					this.remove(last);
				}
			}

			if( ! stored)
			{
				throw new SpenceError('Could not store value of '+key+' into'.this.options.storagePrefix);
			}
		},
		// Retrieve data from localStorage
		get: function (key, options)
		{
			// Retrieve the item.
			var item = root.localStorage.getItem(this.prefixIdentifier(key));

			// When the item wan't found.
			if( ! item)
			{
				// Return false to fall back to the API call.
				return options.error();
			}

			// Decode the response
			this.decode(item, options);
		},
		// Remove an item from localStorage
		remove: function (key)
		{
			root.localStorage.removeItem(key);

			return this;
		}
	});
	
	// SessionStorage driver implementation.
	_.extend(Engines.sessionStorage.prototype, {
		// Test for localStorage
		test: function ()
		{
			return _.has(root, 'sessionStorage');
		},
		// Store data in localStorage
		set: function (key, val, options)
		{
			var tries = 0, stored = false;

			// Try up to 5 times, database could be over size
			while(tries < 5 && stored === false)
			{
				try
				{
					// Try to store the data.
					root.sessionStorage.setItem(
						this.prefixIdentifier(key),
						this.encode(val, options.expiration)
					);

					// The data is now saved.
					stored = true;

					// Add the item to the fetchStack.
					this.fetchStack.push(key);

					// When the data is not the fetchStack
					if (key !== this.options.fetchStack)
					{
						// Store the fetchStack
						this.set(this.options.fetchStack, this.fetchStack, false);
					}
				}
				// Saving the data failed.
				catch(e)
				{
					// Retrieve the last item index.
					var last = this.fetchStack.shift();

					// Remove the last and try again.
					this.remove(last);
				}
			}

			if( ! stored)
			{
				throw new SpenceError('Could not store value of '+key+' into'.this.options.storagePrefix);
			}
		},
		// Retrieve data from sessionStorage
		get: function (key, options)
		{
			// Retrieve the item.
			var item = root.sessionStorage.getItem(this.prefixIdentifier(key));

			// When the item wan't found.
			if( ! item)
			{
				// Return false to fall back to the API call.
				return options.error();
			}

			// Decode the response
			this.decode(item, options);
		},
		// Remove an item from sessionStorage
		remove: function (key)
		{
			root.sessionStorage.removeItem(key);

			return this;
		}
	});

	// LocalDatabase driver implementation.
	_.extend(Engines.localDatabase.prototype, {
		test: function ()
		{
			return !! root.openDatabase;
		},
		init: function ()
		{
			// Generate shortname
			var shortname = this.options.storagePrefix.replace(/[^a-zA-Z 0-9]+/g, '');

			try
			{
				// Open a database
				// This does not include a version so the the db's own version will be used.
				this.connection = root.openDatabase(shortname, '', this.options.storagePrefix, this.options.storageSize);

				// We can now compare the version
				if(this.connection.version !== Version)
				{
					this.migrate();
				}
				else
				{
					EngineUtils.init.apply(this);
				}
			}
			catch(e)
			{
				throw new SpenceError('Could establish a database connection');
			}
		},
		migrate: function ()
		{
			this.connection.changeVersion(this.connection.version, Version, _.bind(function (db)
			{
				this.transaction({
					query: 'DROP TABLE IF EXISTS '+this.options.storagePrefix,
					arguments: [],
					success: _.bind(function (){
						this.transaction({
							query: 'CREATE TABLE IF NOT EXISTS '+this.options.storagePrefix+' (key VARCHAR (255) UNIQUE, payload TEXT)',
							arguments: [],
							error: _.bind(function (e){
								throw new SpenceError('Could not mirgate the database');
							}, this),
							success: _.bind(function (){
								EngineUtils.init.apply(this);
							}, this)
						});
					}, this),
					error: function (){
						throw new SpenceError('Count not migrate the database.');
					}
				});
			}, this));
		},
		transaction: function (options)
		{
			var defaults = {
				query: null,
				error: function (){},
				success: function (){},
				arguments: [],
			};

			options = _.extend({}, defaults, options);

			try
			{
				this.connection.transaction(function (trx){
					trx.executeSql(options.query, options.arguments, options.success, options.error);
				});
			}
			catch(e)
			{
				options.error(e);
			}
		},
		get: function (key, options)
		{
			var success = success = _.bind(function (transaction, result)
			{
				if(result && result.rows && result.rows.length > 0)
				{
					this.decode(result.rows.item(0).payload, options);
				}
				else
				{
					options.error();
				}
			}, this);

			this.transaction({
				query: 'SELECT * FROM '+options.storagePrefix+' WHERE key = ?',
				arguments: [key],
				success: success,
				error: options.error
			});
		},
		set: function (key, val, options)
		{
			var error = options.error;

			options.error = _.bind(function (e)
			{
				if(e.code === 4)
				{
					this.set(key, val, options);
				}
				else
				{
					error(e);
				}
			}, this);

			this.transaction({
				query: 'INSERT OR REPLACE INTO '+this.options.storagePrefix+' (key, payload) VALUES (?, ?)',
				arguments: [key, this.encode(val, options)],
				error: function (){
					throw new SpenceError('Could not save data to local database.');
				},
				success: options.success || function (){}
			});
		}
	});

	// Spence methods.
	var fn = {
		// Post initialization configuration.
		configure: function (options)
		{
			_.extend(this.options, options || {});
			this.engine && this.engine.configure(options);

			return this;
		},
		// Ensure there is a storage engine.
		ensureStorageEngine: function ()
		{
			var engines = this._getValue('engine', this.options, []);
			var matched = false, instance;
			_.isString(engines) && (engines = [engines]);

			// Loop through the engine stack to find an available driver.
			_.each(engines, function (engine){
				if ( ! matched)
				{
					if ( ! _.has(Engines, engine))
					{
						throw new SpenceError('unknow storage engine: '+engine);
					}

					instance = new Engines[engine];
					matched = instance.test();
				};
			}, this);

			if (matched)
			{
				this.engine = instance;
				this.engine.configure(this.options).init();
			}
		},
		extend: function (options)
		{
			_.defaults(options || {}, this.defaults);

			return new this.constructor(options);
		},
		// Retrieve the result from a value.
		_getValue: function (val, options, defVal)
		{
			if (arguments.length === 2 && ! _.isObject(options))
			{
				defVal = options;
				options = null;
			}

			options || (options = this.options);

			if (_.isUndefined(options[val]))
			{
				if ( ! _.isUndefined(defVal))
				{
					throw new SpenceError(' can\'t retrieve "'+val+'" from Spence options.');
				}

				return defVal;
			}

			val = options[val];

			if(_.isfunction (val))
			{
				return val();
			}

			return val;
		},
		get: function (options)
		{
			// Set the default values.
			options || (options = {});
			_.defaults(options, this.options);

			// Wrap the error so the API call can be set as the error callback.
			var error = options.error;

			// Overwrite the error handler.
			options.error = _.bind(function ()
			{
				// Re-attach the original error handler.
				options.error = error;

				// Fire the api call.
				this._fromApi(options);
			}, this);

			// Try to fetch from the local engine.
			this._fromLocal(options);

			return this;
		},
		set: function (payload, options)
		{
			if ( ! this.engine)
			{
				throw new SpenceError('Can\'t inject data without a storage engine.');
			}

			options || (options = this.options);
			_.defaults(options, this.options);

			var key = this._getStorageKey(options);
			this.engine.set(key, payload, options);

			return this;
		},
		// Get the storage key from a options object.
		_getStorageKey: function (options)
		{
			if (options.key !== false && ! _.isUndefined(options.key))
			{
				return options.key;
			}

			return this._getUrl(options).replace(/[^a-zA-Z 0-9]+/g, '-');
		},
		// Get the url from a options object.
		_getUrl: function (options)
		{
			if (_.isUndefined(options.url) || options.url === false)
			{
				return false;
			}

			return options.urlPrefix+this._getValue('url', options);
		},
		// Retrieve from the local storage engine
		_fromLocal: function (options)
		{
			// Check for a reset or a non-existing storage engine
			if ( ! this.engine || this._getValue('reset', options, false))
			{
				alert('no engine');
				// Fore the error callback.
				options.error();
			}
			else
			{
				// Retrieve the storage key.
				var key = this._getStorageKey(options);

				// Retrieve the data from the engine.
				this.engine.get(key, options);
			}
		},
		// Retrieve data from the API
		_fromApi: function (options)
		{
			// Retrieve the url.
			var url = this._getUrl(options);

			// Check for offline mode or no url, fallback to XHR failure
			if (
				(root.navigator && root.navigator.onLine && root.navigator.onLine !== true) ||
				url === false ||
				options.api === false
			)
			{
				options.error();
				return;
			}

			// Wrap the success callback
			var success = _.bind(function (response)
			{
				var originalSuccess = options.success;
				
				// Don't fire the retrieve success on setting.
				options.success = function (){};

				// Make sure an exception is thrown when storing data fails.
				options.error = function (e){
					throw new SpenceError('Can\'t store retrieved data to local storage engine.');
				};

				// Store the response locally when possible
				var key = this._getStorageKey(options);

				if(key !== options.fetchStack)
				{
					this.set(response, options);
				}

				// Trigger the original success callback.
				originalSuccess(response);
			}, this);

			// Fire the api call
			$.ajax({
				type: options.method,
				url: options.urlPrefix+options.url,
				dataType: options.dataType,
				data: options.data,
				async: options.async,
				crossDomain: options.crossDomain,
				timeout: options.requestTimeout,
				// retrieve the username and password
				username: this._getValue('username', options, null),
				password: this._getValue('password', options, null)
			})
			// Attach success handler
			.done(success)
			// Attack error handler
			.fail(options.error);
		}
	}

	// Attach all methods.
	for(var i in fn)
	{
		Spence.prototype[i] = fn[i];
	}

	// Expose Spence to the world.
	root.Spence = Spence;
})
.apply(this);