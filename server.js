var express = require('express');
var app = new express();

var compression   = require('compression');
var bodyParser    = require('body-parser');
var errorHandler  = require('error-handler');
var jade          = require('jade');
var morgan        = require('morgan');
var colors        = require('colors');
//var jsonxml       = require('jsontoxml');

var places = null;
var strings = null;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(compression());


var MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://127.0.0.1:27017/places', function (err, db) {

  if (err) throw err;
  console.log("Connected to database ... Will work with default places collection".inverse);
  places = db.collection('places');
  strings = db.collection('strings');

  app.route('/places/near').get(nearPlacesController);
  app.route('/places/:id/strings').get(placeStringsController);
  app.listen(6190, function() {
    console.log('Express listening'.inverse);
  });
});


function placeStringsController (id) {

  var id = request.params.id;

  strings.find({
    'place_id': id
  }, {_id:false,strings:true}, function (err,strings) {
      if (err) {
        console.log(colors.red(err));
        response.send("Existe un error en el servicio",500);
      }

      response.setHeader('Content-Type','application/json; charset=utf-8');
      response.end(JSON.stringify(strings,null,2));
  });
}


function nearPlacesController(request,response) {
  var latitude = request.query.lat;
  var longitude = request.query.long;
  var maxDistance = request.query.maxDistance;

  places.aggregate([
    {$geoNear: getNearPlacesQueryObject(latitude,longitude,maxDistance,0)}],
    function (err,places) {
      if (err) {
        console.log(colors.red(err));
        response.send("Existe un error en el servicio",500);
      }

      response.setHeader('Content-Type','application/json; charset=utf-8');
      response.end(JSON.stringify(places,null,2));
  });
};

function getNewPlaceObject(name,latitude,longitude,nearAt) {

  var newPlace = {

    name: name,
    loc: {
      type: "Point",
      coordinates: [longitude,latitude]
    }
  };

  if (nearAt)
    newPlace.nearAt = nearAt;

  return newPlace;
};

function getNearPlacesQueryObject (latitude, longitude, maxDistance, minDistance, query) {

  var maxDistance = maxDistance ? parseInt(maxDistance) : 200;
  var nearQueryDocument = {
        near: { type: "Point", coordinates: [ parseFloat(longitude) , parseFloat(latitude) ] },
        distanceField: "dist.calculated",
        maxDistance: maxDistance,
        includeLocs: "dist.location",
        spherical: true};

  if (query)
    nearQueryDocument.query = query;

  return nearQueryDocument;
}
