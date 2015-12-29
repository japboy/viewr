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
      width: 0,
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
      props: [ 'width', 'photos', 'open' ],
      ready: function () {
        console.log('ready?');
      }
    },
    'popup': {
      template: '#popup',
      props: [ 'photo', 'close' ],
      methods: {
        load: function () {
          this.$dispatch('load');
        },
        mousemove: function (ev) {
          var normalized = {
            x: ev.clientX / global.innerWidth,
            y: (ev.clientY + (global.innerHeight / 2)) / global.innerHeight
          };
          this.$el.querySelector('.popup__background').style.backgroundPosition = '50% ' + global.Math.floor(normalized.y * 6) + '%';
        }
      },
      ready: function () {
        this.$el.querySelector('.popup__image img').addEventListener('load', this.load, false);
        window.addEventListener('mousemove', this.mousemove, false);
      },
      beforeDestroy: function () {
        this.$el.querySelector('.popup__image img').removeEventListener('load', this.load);
        window.removeEventListener('mousemove', this.mousemove);
      }
    }
  },
  methods: {
    resize: function () {
      this.$set('width', global.Math.floor(global.innerWidth / 76) * 76);
    },
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
  ready: function () {
    global.addEventListener('resize', this.resize, false);
    this.resize();
  },
  beforeDestroy: function () {
    global.removeEventListener('resize', this.resize);
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

function tumblrUpdated (query, max, offset, photos, done) {
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
      tumblrUpdated(query, max, totalCount, totalPhotos, done);
      return;
    }

    if (actualTotalCount * 2 > totalCount) {
      done({ photos: totalPhotos, total: totalCount });
    }
  });
}
