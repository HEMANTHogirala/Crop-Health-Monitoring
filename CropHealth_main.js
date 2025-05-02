// Define the Area of Interest (AOI)
// Define the Area of Interest (AOI)
 // Update with your asset path
var table=table.geometry();
var area = table.area(0.01).divide(1e6)
print('BoundaryArea',area)
// Load Sentinel-2 Data for NDVI & EVI
var s2 = ee.ImageCollection("COPERNICUS/S2")
  .filterBounds(table)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 1))
  .select(['B4', 'B8', 'B8A']); // Red, NIR, and narrow NIR bands
Map.setOptions('SATELLITE');

// Compute NDVI & EVI
var addIndices = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');  
  var evi = image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': image.select('B8'),
      'RED': image.select('B4'),
      'BLUE': image.select('B8A')
    }).rename('EVI');
  return image.addBands([ndvi, evi]);
};


// Apply NDVI & EVI calculation to all images
var s2Indexed = s2.map(addIndices);

// Reduce to mean NDVI & EVI for 2023
var meanNDVI = s2Indexed.select('NDVI').mean();
var meanEVI = s2Indexed.select('EVI').mean();

// Visualization parameters
var ndviVis = {min: 0, max: 1, palette: ['red', 'yellow', 'green']};
var eviVis = {min: 0, max: 1, palette: ['blue', 'white', 'green']};
Map.centerObject(table,15)
// Add layers to map
Map.addLayer(meanNDVI.clip(table), ndviVis, "Mean NDVI (2023)");
Map.addLayer(meanEVI.clip(table), eviVis, "Mean EVI (2023)");
Map.addLayer(table,{color:'green'},"krishna Region")
// Load MODIS Evapotranspiration (ET) Data
var modisET = ee.ImageCollection("MODIS/061/MOD16A2")
  .filterBounds(table)
  .filterDate('2023-01-01', '2023-12-31')
  .select('ET');

// Resample MODIS to match Sentinel resolution (10m)
var modisETResampled = modisET.mean().resample('bilinear').reproject({
  crs: meanNDVI.projection(),
  scale: 10
});

// Load CHIRPS Rainfall Data for Drought Monitoring
var rainfall = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
  .filterBounds(table)
  .filterDate('2023-01-01', '2023-12-31')
  .select('precipitation');

// Compute SPI (Standardized Precipitation Index)
var spi = rainfall.reduce(ee.Reducer.stdDev()).rename('SPI');

// Compute Drought Index (NDVI - ET)
var droughtIndex = meanNDVI.subtract(modisETResampled).rename('Drought_Index');

// Compute min and max dynamically for visualization
var droughtStats = droughtIndex.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: table,
  scale: 10,
  bestEffort: true
});

var minDrought = ee.Number(droughtStats.get('Drought_Index_min'));
var maxDrought = ee.Number(droughtStats.get('Drought_Index_max'));

// Define new visualization parameters
var droughtVis = {
  min: minDrought.getInfo(), 
  max: maxDrought.getInfo(),
  palette: ['red', 'yellow', 'green']
};

// Add Drought Risk Map to the Map
Map.addLayer(droughtIndex.clip(table), droughtVis, "Drought Risk Map");

// Print debug information
print("Drought Index Min:", minDrought);
print("Drought Index Max:", maxDrought);
var ndviChart = ui.Chart.image.series({
  imageCollection: s2Indexed.select('NDVI'),
  region: table,
  reducer: ee.Reducer.mean(),
  scale: 500,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'NDVI Time-Series for Krishna',
  hAxis: {title: 'Year'},
  vAxis: {title: 'NDVI'},
  lineWidth: 2,
  pointSize: 3
});

var eviChart = ui.Chart.image.series({
  imageCollection: s2Indexed.select('EVI'),
  region: table,
  reducer: ee.Reducer.mean(),
  scale: 500,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'EVI Time-Series for Krishna',
  hAxis: {title: 'Year'},
  vAxis: {title: 'EVI'},
  lineWidth: 2,
  pointSize: 3
});
print(ndviChart);
print(eviChart);
// Define AOI for Vidarbha (Maharashtra)
var vidarbha = ee.Geometry.Rectangle([76.5, 19.5, 79.5, 21.5]); // Adjust as needed
var area = vidarbha.area(0.01).divide(1e6)
print('BoundaryArea',area)
// Load Sentinel-2 for NDVI
var s2Vidarbha = ee.ImageCollection("COPERNICUS/S2")
  .filterBounds(vidarbha)
  .filterDate('2023-01-01', '2023-12-31')
  .map(function(img) {
    var ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
    var evi = img.expression(
      '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
        'NIR': img.select('B8'),
        'RED': img.select('B4'),
        'BLUE': img.select('B2')
      }).rename('EVI');
    
    return img.addBands([ndvi, evi]);
    
  });
Map.addLayer(s2Vidarbha,[],"s2Vidarbha");
var meanNDVI = s2Vidarbha.select('NDVI').mean();
var meanEVI = s2Vidarbha.select('EVI').mean();
// Load MODIS Evapotranspiration (ET)
var modisET = ee.ImageCollection("MODIS/061/MOD16A2")
  .filterBounds(vidarbha)
  .filterDate('2023-01-01', '2023-12-31')
  .select('ET')
  .mean();

// Resample MODIS ET to match Sentinel-2 resolution
var modisETResampled = modisET.resample('bilinear').reproject({
  crs: meanNDVI.projection(),
  scale: 10
});

// Compute Drought Index (NDVI - ET)
var droughtIndex = meanNDVI.subtract(modisETResampled).rename('Drought_Index');

// Normalize the drought index for better visualization
var minDrought_vidarbha = droughtIndex.reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: vidarbha,
  scale: 10,
  bestEffort: true
}).get('Drought_Index');

var maxDrought_vidarbha = droughtIndex.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: vidarbha,
  scale: 10,
  bestEffort: true
}).get('Drought_Index');

// Apply normalization
var droughtIndexNorm = droughtIndex.unitScale(minDrought_vidarbha, maxDrought_vidarbha);
var minDrought_vidarbha = ee.Number(droughtStats.get('Drought_Index_min'));
var maxDrought_vidarbha = ee.Number(droughtStats.get('Drought_Index_max'));
print("Drought Index Min:", minDrought_vidarbha);
print("Drought Index Max:", maxDrought_vidarbha);
// Visualization
var droughtVis = {min: 0, max: 1, palette: ['red', 'yellow', 'green']};

// Add Layers to Map
Map.centerObject(vidarbha, 10);
Map.addLayer(droughtIndexNorm.clip(vidarbha), droughtVis, "Drought Risk Map - Vidarbha");
Map.addLayer(vidarbha, {color: 'yellow'}, "Vidarbha AOI");
var ndviChartVidarbha = ui.Chart.image.series({
  imageCollection: s2Vidarbha.select('NDVI'),
  region: vidarbha,
  reducer: ee.Reducer.mean(),
  scale: 500,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'NDVI Time-Series for Vidarbha',
  hAxis: {title: 'Year'},
  vAxis: {title: 'NDVI'},
  lineWidth: 2,
  pointSize: 3
});

var eviChartVidarbha = ui.Chart.image.series({
  imageCollection: s2Vidarbha.select('EVI'),
  region: vidarbha,
  reducer: ee.Reducer.mean(),
  scale: 500,
  xProperty: 'system:time_start'
}).setOptions({
  title: 'EVI Time-Series for Vidarbha',
  hAxis: {title: 'Year'},
  vAxis: {title: 'EVI'},
  lineWidth: 2,
  pointSize: 3
});

print(ndviChartVidarbha);
print(eviChartVidarbha);

// Center the map on Vidarbha
Map.centerObject(vidarbha, 10);
Map.addLayer(meanNDVI.clip(vidarbha), ndviVis, "Mean NDVI (2023)");
Map.addLayer(meanEVI.clip(vidarbha), eviVis, "Mean EVI (2023)");
// Function to switch regions
function switchRegion(region) {
  var aoi, zoomLevel;
  
  if (region === 'Krishna') {
    aoi = table;
    zoomLevel = 13;
  } else if (region === 'Vidarbha') {
    aoi = vidarbha;
    zoomLevel = 8;
  }
  
  Map.centerObject(aoi, zoomLevel);  // Auto-zoom to selected region
}


// Create a dropdown for region selection
var regionDropdown = ui.Select({
  items: ['Krishna', 'Vidarbha'],
  placeholder: 'Select a Region',
  onChange: function(region) {
    switchRegion(region);
  }
});

// Add the dropdown to the UI
var panel = ui.Panel([ui.Label('🌍 Switch Region'), regionDropdown]);
ui.root.insert(0, panel);

// Default view (Krishna region)
switchRegion('Krishna');
var ndviVectors = meanNDVI.gt(0.1).selfMask().reduceToVectors({
  geometry: table, // Use Krishna AOI or Vidarbha AOI
  scale: 500,
  geometryType: "polygon",
  eightConnected: false
});

// // Export NDVI Shapefile
// Export.table.toDrive({
//   collection: ndviVectors,
//   description: "NDVI_Krishna",
//   folder: "GEE_Exports",
//   fileFormat: "SHP"
// });
// var ndviVectors = meanNDVI.gt(0.1).selfMask().reduceToVectors({
//   geometry: vidarbha, // Use Krishna AOI or Vidarbha AOI
//   scale: 500,
//   geometryType: "polygon",
//   eightConnected: false
// });

// // Export NDVI Shapefile
// Export.table.toDrive({
//   collection: ndviVectors,
//   description: "NDVI_Vidarbha",
//   folder: "GEE_Exports",
//   fileFormat: "SHP"
// });
// var droughtVectors = droughtIndex.gt(0.1).selfMask().reduceToVectors({
//   geometry: table, // Use Krishna AOI or Vidarbha AOI
//   scale: 500,
//   geometryType: "polygon",
//   eightConnected: false
// });

// // Export Drought Risk Map as Shapefile
// Export.table.toDrive({
//   collection: droughtVectors,
//   description: "DroughtRisk_Krishna",
//   folder: "GEE_Exports",
//   fileFormat: "SHP"
// });

// var droughtVectors = droughtIndex.gt(0.1).selfMask().reduceToVectors({
//   geometry: vidarbha, // Use Krishna AOI or Vidarbha AOI
//   scale: 500,
//   geometryType: "polygon",
//   eightConnected: false
// });

// // Export Drought Risk Map as Shapefile
// Export.table.toDrive({
//   collection: droughtVectors,
//   description: "DroughtRisk_Vidarbha",
//   folder: "GEE_Exports",
//   fileFormat: "SHP"
// });
// print("NDVI Feature Count:", ndviVectors.size());
// Create a UI Panel
var oeel=require('users/OEEL/lib:loadAll')

var northWidget=oeel.Map.symbol('compass')
northWidget.style().set({position:'top-right'})
Map.add(northWidget)

// set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});