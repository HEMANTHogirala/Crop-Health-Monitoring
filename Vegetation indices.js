// Define the Area of Interest (AOI)
var table = 
    ee.Geometry.Polygon(
        [[[80.7254281500458, 16.459760557628318],
          [80.7254281500458, 16.449141856690236],
          [80.73946146761172, 16.449141856690236],
          [80.73946146761172, 16.459760557628318]]], null, false);
Map.addLayer(table, {}, 'AOI');
Map.centerObject(table, 15);

// Set the map to satellite view
Map.setOptions('SATELLITE');

// Functions to add each index band to an image
function addNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('ndvi');
  return image.addBands(ndvi);
}

function addNDWI(image) {
  var ndwi = image.normalizedDifference(['B8', 'B12']).rename('ndwi');
  return image.addBands(ndwi);
}

function addNDSM(image) {
  var ndsm = image.normalizedDifference(['B12', 'B8']).rename('ndsm');
  return image.addBands(ndsm);
}

function addSAVI(image) {
  var nir = image.select('B8');
  var red = image.select('B4');
  var savi = nir.subtract(red).divide(nir.add(red).add(0.5)).multiply(1.5).rename('savi');
  return image.addBands(savi);
}

function addEVI(image) {
  var nir = image.select('B8');
  var red = image.select('B4');
  var blue = image.select('B2');
  var G = 2.5, L = 1, C1 = 6, C2 = 7.5;
  var evi = image.expression(
    'G * ((NIR - RED) / (NIR + C1 * RED - C2 * BLUE + L))', {
      'NIR': nir,
      'RED': red,
      'BLUE': blue,
      'G': G,
      'C1': C1,
      'C2': C2,
      'L': L
    }).rename('evi');
  return image.addBands(evi);
}

// Function to calculate indices for the entire date range and clip to the AOI
function calculateIndices(dateStart, dateEnd) {
  var collection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                    .filterDate(dateStart, dateEnd)
                    .filterBounds(table)
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
                    .map(addNDVI)
                    .map(addNDWI)
                    .map(addNDSM)
                    .map(addSAVI)
                    .map(addEVI)
                    .map(function(image) {
                      return image.clip(table); // Clip each image to the AOI
                    });
  return collection;
}

// Define the full date range from 2018-01-01 to 2023-12-31
var startDate = '2018-01-01';
var endDate = '2023-12-31';

// Calculate the indices for the full date range
var indicesCollection = calculateIndices(startDate, endDate);

// Calculate the mean image for the entire period to add as layers to the map
var indicesImage = indicesCollection.mean();

// Add layers for each index to the map
var visParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};
Map.addLayer(indicesImage.select('ndvi'), visParams, 'NDVI 2018 to 2023');
Map.addLayer(indicesImage.select('evi'), visParams, 'EVI 2018 to 2023');
Map.addLayer(indicesImage.select('ndwi'), visParams, 'NDWI 2018 to 2023');
Map.addLayer(indicesImage.select('savi'), visParams, 'SAVI 2018 to 2023');
Map.addLayer(indicesImage.select('ndsm'), visParams, 'NDSM 2018 to 2023');

// Function to export a time series as a CSV file
function exportTimeSeries(collection, indexName) {
  var timeSeries = collection.select(indexName)
    .map(function(image) {
      return ee.Feature(null, {
        'date': image.date().format('YYYY-MM-dd'),
        'value': image.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: table,
          scale: 500
        }).get(indexName)
      });
    });
  
  Export.table.toDrive({
    collection: timeSeries,
    description: indexName + '_TimeSeries_2018_to_2023',
    fileFormat: 'CSV'
  });
}

// Function to display time series charts in Console
function displayTimeSeriesChart(collection, indexName) {
  var chart = ui.Chart.image.series({
      imageCollection: collection.select(indexName),
      region: table,
      reducer: ee.Reducer.mean(),
      scale: 500
    })
    .setOptions({
      title: indexName.toUpperCase() + ' Time Series: 2018 to 2023',
      vAxis: {title: indexName.toUpperCase()},
      hAxis: {title: 'Date'}
    });
  print(chart);
}

// Export time series for each index
exportTimeSeries(indicesCollection, 'ndvi');
exportTimeSeries(indicesCollection, 'evi');
exportTimeSeries(indicesCollection, 'ndwi');
exportTimeSeries(indicesCollection, 'savi');
exportTimeSeries(indicesCollection, 'ndsm');

// Display time series charts in Console for each index
displayTimeSeriesChart(indicesCollection, 'ndvi');
displayTimeSeriesChart(indicesCollection, 'evi');
displayTimeSeriesChart(indicesCollection, 'ndwi');
displayTimeSeriesChart(indicesCollection, 'savi');
displayTimeSeriesChart(indicesCollection, 'ndsm');
