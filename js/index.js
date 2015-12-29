'use strict';

// Common scopes

var global = global || window;
var _ = global._;
var Vue = global.Vue, VueRouter = global.VueRouter;


// Common variables

/** Tumblr API key */
var tumblrAPIKey = 'WSFaPkHCVzqG6O4uI6XwTgqiqr884I0EDZWS1j04yeRhf9CQ2n';

/** System language */
var lang = global.navigator.language.match(/^[a-z]{2}/)[0];
/** Base title of document */
var documentTitle = global.document.title;


// Vue custom filters

/** Formatted date from Date object */
Vue.filter('date', function (value) {
  return moment(value).locale('ja').format('LL');
});

/** HTML paragraphs from block text */
Vue.filter('paragraph', function (value) {
  value = value.trim();
  return (value.length > 0 ? '<p>' + value.replace(/[\r\n]+/, '</p><p>') + '</p>' : null);
});

/** Swap break lines to spaces */
Vue.filter('nobreaks', function (value) {
  return value.replace(/(\n|\r\n)/g, ' ');
});

/** Smallest thumbnail */
Vue.filter('thumbnail', function (values) {
  return _
  .chain(values)
  .sortBy('width')
  .first()
  .value().url;
});


// Vue subclasses for pages

/** Fundamental subclass for all the pages */
var App = Vue.extend({});

/** Viewer subclass */
var Viewer = Vue.extend({
  template: '#viewer',
  data: function () {
    return {
      photos: [],
      total: 0,
      photo: null,
      index: 0,
      playing: false
    };
  },
  components: {
    'thumbnails': {
      template: '#thumbnails',
      props: [ 'photos', 'open' ]
    },
    'popup': {
      template: '#popup',
      props: [ 'photo', 'close' ],
      ready: function () {
        var that = this;
        global.document.querySelector('.popup__image img').addEventListener('load', function () {
          that.$dispatch('load');
        }, false);
      }
    }
  },
  methods: {
    open: function (index) {
      var photo = this.$get('photos')[index];
      this.$set('photo', photo);
      this.$set('index', index);
    },
    close: function () {
      this.$delete('photo');
    },
    backward: function () {
      var index = this.$get('index'), total = this.$get('total');
      if (0 <= index - 1) {
        this.$set('index', index - 1);
        this.open(index - 1);
      }
    },
    forward: function () {
      var index = this.$get('index'), total = this.$get('total');
      if (total > index + 1) {
        this.$set('index', index + 1);
        this.open(index + 1);
      }
      if (total === index + 1) {
        var query = global.encodeURIComponent(this.$route.params.query);
        var that = this;
        var photos = this.$get('photos'), total = this.$get('total');
        tumblrUpdated(query, total + 40, total, photos, function (data) {
          that.$set('photos', data.photos);
          that.$set('total', data.total);
          that.forward();
        });
      }
    },
    pause: function () {
      this.$set('playing', false);
    },
    play: function () {
      this.$set('playing', true);
      this.forward();
    }
  },
  events: {
    'load': function () {
      var playing = this.$get('playing');
      if (!playing) return;
      var that = this;
      var timeoutId = global.setTimeout(function () {
        global.clearTimeout(timeoutId);
        that.forward();
      }, 3000);
    }
  },
  route: {
    data: function (transition) {
      var query = this.$route.params.query ? global.encodeURIComponent(this.$route.params.query) : 'starwars';
      tumblrUpdated(query, 100, 0, [], function (data) {
        transition.next(data);
      });
    }
  }
});


// Vue router declaration

/** Main router */
var router = new VueRouter();

/** Route bindings */
router.map({
  '/': {
    component: Viewer
  },
  '/:query': {
    component: Viewer
  },
});

router.start(App, '#app');


// API

function tumblrUpdated (query, max, offset, photos, callback) {
  var url = (function () {
    var patterns = [
      {
        re: /^[^\.\/]+\.[^\.\/]+/,
        url: 'https://api.tumblr.com/v2/blog/' + query + '/posts/photo?api_key=' + tumblrAPIKey + '&offset=' + offset
      },
      {
        re: /^[^\.\/]+$/,
        url: 'https://api.tumblr.com/v2/tagged/?api_key=' + tumblrAPIKey + '&tag=' + query
      }
    ];
    return _.
    chain(patterns)
    .filter(function (pattern) { return pattern.re.test(query); })
    .first()
    .value().url;
  })();

  Vue.http
  .jsonp(url)
  .then(function (response) {
    var posts = response.data.response.posts || response.data.response;

    var currentPhotos = _
    .chain(posts)
    .filter(function (post) { return 'photo' === post.type; })
    .map(function (post) {
      return _.map(post.photos, function (photo) {
        return _.extend(photo, _.omit(post, 'photos'));
      });
    })
    .flatten()
    .value();

    var actualTotalCount = response.data.response.total_posts || 20;
    var maxCount = actualTotalCount > max ? max : currentPhotos.length;
    var totalPhotos = _.union(photos, currentPhotos);
    var totalCount = totalPhotos.length;

    console.log(maxCount, totalCount);

    if (actualTotalCount > totalCount && maxCount > totalCount) {
      tumblrUpdated(query, max, totalCount, totalPhotos, callback);
      return;
    }

    if (actualTotalCount * 2 > totalCount) {
      callback({ photos: totalPhotos, total: totalCount });
    }
  });
}
