# Spence.js

An easy way to store API data offline.

## Synopsis

You've got a web-app that needs easy offline access to you data providing rest-api. The only thing is, you can't be bothered having to setup an ajax interface, that talks with a localStorage or when available a localDatabase (FileStorage and IndexedDB are coming up). This is where Spence comes to the resque!

## What does Spence do?

Spence has a familiar interface for talking with your app. So you'll feel right at home using it. Behind the scenes Spence.js takes care of all the funny business. Storing and retrieving data from a local storage source is no longer something to worry about.

## Awesome, let's get crackin' … but wait!

First things first. Spence relies heavily on 2 libraries. Luckilly these are very common in your everyday web project already:

### [jQUery](http://jquery.com) / [Zepto](http://zeptojs.com) / [Ender](http://ender.no.de)

For all the ajax calls, Spence needs to have one of these libraries. It realy doesn't matter which one because they all have a similar API.

### [Underscore.js](http://underscorejs.org)

Underscore is an awesome utility belt for all your websites and applications. It smooths out some of the browser quirks you might come across when you're doing some vanilla javascripting.

## Let's set things up
Include Underscore.js and a jQuery-ish library before including Spence.js like so:

```html
<head>
	...
	<script src="/assets/js/underscore.js"></script>
	<script src="/assets/js/jquery.js"></script>
	<script src="/assets/js/spence.js"></script>
	<script src="/assets/js/your-script.js"></script>
	...
</head>
```

#### Now we've got Spence we can dive into `your-script.js` to put spence to work.

```javascript
// We'll start by initializing a Spence instance.
var MySpence = new Spence({
	// configuration options.

	// Engine fallback stack.
	engines: ['localDatabase', 'localStorage'],
	/**
	 * When initializing, Spence will test from
	 * first to last wether a driver is supported.
	 * When none of the drivers is supported, it'll
	 * fall back to regular API usage, no drawbacks here.
	 */

	// You can also supply a username an password:
	username: 'my username',
	password: function(){
		return 'my password';
	},
	/**
	 * Spence will automatically get the result of
	 * the username and/or password so you don't
	 * have to hardcode them into the config.
	 */

	 // Spence also handles versioning.
	 version: '0.1-alpha'
	 /**
	  * Unlike localDatabases, localStorage
	  * doesn't handle versioning, but now it does.
	  */
});
```

#### Now that we've got it all setup, let's really put it to work:

```javascript
MySpence.get({
	// Where should we get the data from?
	url: '/data.json',

	// When does is expire? (in seconds)
	// set to false to never expire
	expiration: 60 * 60 * 24, // one day

	// success calback
	success: function(response){
		// Do something with the data.
	},

	// error callback
	error: function(){
		alert('Oh no!');
	},
});
```

## What's to come?

At least two more engines will come available to Spence (IndexedDB and Filesystem). So keep an eye out for changes in this repo.

Easy as pie! Enjoy.