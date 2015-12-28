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
      height: null,
      photo: null
    };
  },
  components: {
    'photos': {
      template: '#photos',
      props: [ 'item', 'open' ]
    },
    'thumbnail': {
      template: '#thumbnail',
      props: [ 'photo', 'height', 'close' ]
    }
  },
  methods: {
    open: function (photo) {
      this.$set('photo', photo);
      this.$set('height', Math.max(global.innerHeight, global.document.body.clientHeight, photo.original_size.height + 60));
    },
    close: function () {
      this.$delete('photo');
      this.$delete('height');
    }
  },
  route: {
    data: function (transition) {
      var query = this.$route.params.query ? global.encodeURIComponent(this.$route.params.query) : 'starwars';
      var recursiveJSONP = function (count, photos) {
        Vue.http
        .jsonp((function (query) {
          var patterns = [
            {
              re: /^[^\.\/]+\.[^\.\/]+/,
              url: 'https://api.tumblr.com/v2/blog/' + query + '/posts/photo?api_key=' + tumblrAPIKey + '&offset=' + count
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
        })(query))
        .then(function (response) {
          //console.debug(response.data);
          var posts = response.data.response.posts || response.data.response;
          var currentPhotos = _.filter(posts, function (item) { return 'photo' === item.type; });
          var total = response.data.response.total_posts ? 100 : 20;
          var _photos = _.union(photos, currentPhotos);
          var _count = count + currentPhotos.length;
          console.log(total, _count);
          if (20 > _count || total <= _count) return transition.next({ items: _photos });
          recursiveJSONP(_count, _photos);
        });
      };
      recursiveJSONP(0, []);
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
