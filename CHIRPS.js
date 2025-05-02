// Define the Area of Interest (AOI)
var table = ee.Geometry.Polygon(
  [[[80.7254281500458, 16.459760557628318],
    [80.7254281500458, 16.449141856690236],
    [80.73946146761172, 16.449141856690236],
    [80.73946146761172, 16.459760557628318]]], null, false);
Map.addLayer(table, {}, 'AOI');
Map.centerObject(table, 15);

// Define the phases (same as before)
var phases = [
  {start: '2018-06-01', end: '2019-02-28'},
  {start: '2019-06-01', end: '2020-02-28'},
  {start: '2020-06-01', end: '2021-02-28'},
  {start: '2021-06-01', end: '2022-02-28'},
  {start: '2022-06-01', end: '2023-02-28'}
];

// Load CHIRPS Rainfall ImageCollection
var CHIRPS = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY");

// Visualization parameters
var viz = {
  min: 0,
  max: 3000,  // Adjust this based on expected rainfall range in mm
  palette: ['lightblue', 'blue', 'darkblue', 'purple', 'red', 'darkred'],
};

// Function to calculate annual rainfall for each phase and export CSV
function calculateRainfallForPhase(startDate, endDate, phaseTitle) {
  var start = ee.Date(startDate);
  var end = ee.Date(endDate);
  
  // Filter CHIRPS collection by the date range and AOI
  var filteredCHIRPS = CHIRPS.filterDate(start, end).filterBounds(table);
  
  // Sum the daily rainfall data to get total rainfall for the period
  var annualRainfall = filteredCHIRPS.reduce(ee.Reducer.sum()).clip(table)
                                       .set('system:time_start', start.millis())
                                       .set('system:time_end', end.millis());

  // Add the annual rainfall layer to the map
  Map.addLayer(annualRainfall, viz, 'Annual Rainfall ' + phaseTitle);
  
  // Export the rainfall image to Google Drive
  Export.image.toDrive({
    image: annualRainfall,
    description: 'CHIRPS_' + phaseTitle,
    folder: 'Rainfall_CHIRPS',
    region: table.bounds(),
    scale: 5000,  // Adjust scale as needed
    maxPixels: 1e13
  });
  
  // Create a FeatureCollection for the time series data
  var rainfallTimeSeries = filteredCHIRPS.map(function(image) {
    var date = image.get('system:time_start');
    var totalRainfall = image.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: table,
      scale: 5000,  // Adjust scale to match image resolution
      maxPixels: 1e8
    }).get('precipitation');
    
    return ee.Feature(null, {
      'date': date,
      'total_rainfall_mm': totalRainfall
    });
  });
  
  // Convert to FeatureCollection
  var rainfallFeatureCollection = ee.FeatureCollection(rainfallTimeSeries);
  
  // Export the time series of rainfall data to CSV
  Export.table.toDrive({
    collection: rainfallFeatureCollection,
    description: 'Rainfall_Time_Series_' + phaseTitle,
    folder: 'Rainfall_CHIRPS',
    fileFormat: 'CSV'
  });
  
  // Display a time-series chart of monthly rainfall for the phase
  var chart = ui.Chart.image.series({
    imageCollection: filteredCHIRPS,
    region: table,
    reducer: ee.Reducer.sum(),
    scale: 10,
    xProperty: 'system:time_start'
  })
  .setOptions({
    title: 'Monthly Rainfall ' + phaseTitle,
    vAxis: {title: 'Rainfall (mm)'},
    hAxis: {title: 'Time'},
    lineWidth: 1,
    pointSize: 2,
    interpolateNulls: true
  });
  
  // Print the chart for this phase
  print(chart);
  
  // Create and add a legend for the rainfall layer
  var legend = ui.Panel({
    style: {position: 'bottom-right', padding: '8px 15px'}
  });
  
  // Add legend title
  var legendTitle = ui.Label({
    value: 'Rainfall (mm)',
    style: {
      fontWeight: 'bold',
      fontSize: '18px',
      margin: '0 0 4px 0',
      padding: '0'
    }
  });
  legend.add(legendTitle);
  
  // Create legend gradient image
  var lon = ee.Image.pixelLonLat().select('latitude');
  var gradient = lon.multiply((viz.max - viz.min) / 100.0).add(viz.min);
  var legendImage = gradient.visualize(viz);
  
  // Add legend max value label
  legend.add(ui.Label({
    value: viz.max,
    style: {margin: '4px 0 0 0'}
  }));
  
  // Add legend thumbnail
  legend.add(ui.Thumbnail({
    image: legendImage,
    params: {bbox: '0,0,10,100', dimensions: '10x200'},
    style: {padding: '1px', position: 'bottom-center'}
  }));
  
  // Add legend min value label
  legend.add(ui.Label({
    value: viz.min,
    style: {margin: '0 0 4px 0'}
  }));
  
  Map.add(legend);
}

// Loop through each phase, calculate rainfall, add to map, export CSV and image
phases.forEach(function(phase) {
  var phaseTitle = phase.start + ' to ' + phase.end;
  calculateRainfallForPhase(phase.start, phase.end, phaseTitle);
});
