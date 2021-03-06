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
var ObjectID = require('mongodb').ObjectID;

MongoClient.connect('mongodb://127.0.0.1:27017/places', function (err, db) {

  if (err) throw err;
  console.log("Connected to database ... Will work with default places collection".inverse);
  places = db.collection('places');
  strings = db.collection('strings');

  app.route('/places').get(allPlacesController).post(newPlaceController);
  app.route('/places/near').get(nearPlacesController);
  app.route('/places/:id/strings').get(placeStringsController).post(newStringsForPlaceController);
  app.route('/strings').get(allStringsController);

  app.listen(6199, function() {
    console.log('Express listening'.inverse);
  });
});

function allPlacesController (request,response) {

  places.find({}).toArray(function (err,result) {

    if (err)
      response.send(JSON.stringify(err), 500);

    else{
      console.log(result);
      response.setHeader('Content-Type','application/json; charset=utf-8');
      response.end(JSON.stringify(result, null, 2));
    }
  });
}

function allStringsController (request,response) {
  strings.find({}).toArray(function (err,result) {

    if (err)
      response.send(JSON.stringify(err), 500);

    else{
      console.log(result);
      response.setHeader('Content-Type','application/json; charset=utf-8');
      response.end(JSON.stringify(result, null, 2));
    }
  });
}

function newPlaceController (request,response) {

  console.log(request.body);
  var latitude = request.body.lat;
  var longitude = request.body.long;
  var name = request.body.name;

  var newPlace = getNewPlaceObject(name,latitude,longitude);  // This returns the object/document to be inserted

  places.insert(newPlace, function (err,createdPlace) {

    if (err)
      response.send(JSON.stringify(err),500);

    else {

      strings.insert({ place_id: createdPlace.ops[0]._id, strings: []}, function (err,result) {
        if (!err)
          response.send(JSON.stringify(createdPlace.ops[0]._id),200);
        else
          response.send(JSON.stringify(err),500);
      });
    }
  });
}

function newStringsForPlaceController (request,response) {
  var newStrings = request.body.strings;
  var place = request.params.id;
  strings.update(
   { place_id: new ObjectID(place) },
   { $addToSet: { strings: { $each: newStrings } } },
   function (err,result) {
    if (!err)
      response.send(JSON.stringify(result.ops),200);
    else
      response.send(JSON.stringify(err),500);
   }
 )
}

function placeStringsController (request,response) {

  var id = request.params.id;

  strings.find({
    'place_id': new ObjectID(id)
  },{_id:false,strings:true}).toArray( function (err,foundStrings) {
      if (err) {
        console.log(colors.red(err));
        response.send("Existe un error en el servicio",500);
      }
      response.setHeader('Content-Type','application/json; charset=utf-8');
      response.end(JSON.stringify(foundStrings));
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


