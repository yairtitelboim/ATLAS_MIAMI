import mapboxgl from 'mapbox-gl';
import { DC_BOUNDS } from './constants';
import { analyzeCensusData } from './hooks/useCensusData';
import { AINavigator } from './hooks/useAINavigator';
import { askClaude } from '../../services/claude';
import { 
  initializeParticleLayers, 
  initializePowerGrid 
} from './hooks/mapAnimations';
import { 
  MAP_CONFIG, 
  BUILDING_COLORS,
  MIAMI_BOUNDS 
} from './constants';
import styled from 'styled-components';
import { createRoot } from 'react-dom/client';
import { brickellGEOIDs } from './constants/geoIds';

// Coordinate generation
export const generateRandomLocation = (bounds) => {
  const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
  const lng = bounds.west + Math.random() * (bounds.east - bounds.west);
  return [lng, lat];
};

// Building data generation
export const generateBuildingData = (id, bounds) => {
  const coords = generateRandomLocation(bounds);
  const propertyTypes = ['office', 'datacenter', 'mixed-use', 'industrial'];
  const neighborhoods = ['Downtown', 'Navy Yard', 'NoMa', 'Capitol Hill', 'Georgetown', 'Foggy Bottom'];
  
  return {
    type: "Feature",
    properties: {
      id: id,
      address: generateAddress(coords),
      property_type: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
      neighborhood: getNeighborhoodFromCoords(coords, neighborhoods),
      powerScore: Math.random().toFixed(2),
      coolingScore: Math.random().toFixed(2),
      squareFeet: Math.floor(Math.random() * (1000000 - 50000) + 50000),
      yearBuilt: Math.floor(Math.random() * (2023 - 1950) + 1950),
      location: {
        latitude: coords[1],
        longitude: coords[0],
        address: generateAddress(coords)
      }
    },
    geometry: {
      type: "Point",
      coordinates: coords
    }
  };
};

// Generate mock data for multiple buildings
export const generateMockData = (count = 50) => {
  const features = [];
  for (let i = 0; i < count; i++) {
    features.push(generateBuildingData(i, DC_BOUNDS));
  }
  return {
    type: "FeatureCollection",
    features: features
  };
};

export const generateAddress = (coordinates) => {
  const streets = [
    'K St NW', 'M St NW', 'Pennsylvania Ave', 'Connecticut Ave', 
    'Wisconsin Ave', 'Massachusetts Ave', 'Rhode Island Ave', 'New York Ave'
  ];
  const numbers = ['1200', '1400', '1600', '1800', '2000', '2200'];
  
  const streetIndex = Math.floor((coordinates[0] * 10) % streets.length);
  const numberIndex = Math.floor((coordinates[1] * 10) % numbers.length);
  
  return `${numbers[numberIndex]} ${streets[streetIndex]}`;
};

export const getNeighborhoodFromCoords = (coordinates) => {
  const neighborhoods = [
    { name: 'Downtown', lat: 38.9, lon: -77.03 },
    { name: 'Navy Yard', lat: 38.87, lon: -77.00 },
    { name: 'NoMa', lat: 38.91, lon: -77.01 },
    { name: 'Capitol Hill', lat: 38.89, lon: -77.00 },
    { name: 'Foggy Bottom', lat: 38.9, lon: -77.05 },
    { name: 'Georgetown', lat: 38.91, lon: -77.06 }
  ];
  
  let closest = neighborhoods[0];
  let minDistance = Infinity;
  
  neighborhoods.forEach(hood => {
    const distance = Math.sqrt(
      Math.pow(coordinates[1] - hood.lat, 2) + 
      Math.pow(coordinates[0] - hood.lon, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closest = hood;
    }
  });
  
  return closest.name;
};

export const distanceToLineSegment = (point, start, end) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) {
    return Math.sqrt(
      Math.pow(point[0] - start[0], 2) + 
      Math.pow(point[1] - start[1], 2)
    );
  }

  const t = Math.max(0, Math.min(1, 
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (length * length)
  ));

  const projection = [
    start[0] + t * dx,
    start[1] + t * dy
  ];

  return Math.sqrt(
    Math.pow(point[0] - projection[0], 2) + 
    Math.pow(point[1] - projection[1], 2)
  );
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const easeOutCubic = (x) => {
  return 1 - Math.pow(1 - x, 3);
};

// export const handleMapClick = (map, e) => {
//   // Remove this function or comment it out
// };

export const initializeLayers = (map) => {
  if (!map) return;

  // Initialize base layers
  initializeMapLayers(map);
  
  // Initialize particle system
  initializeParticleLayers(map);
  
  // Initialize power grid
  initializePowerGrid(map);
};

export const calculateBuildingEfficiency = (building) => {
  const height = building.properties.height || 0;
  const area = calculateBuildingArea(building.geometry.coordinates[0]);
  return height > 30 && area > 200 && Math.random() > 0.6;
};

export const calculateBuildingArea = (coordinates) => {
  if (!coordinates || coordinates.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    area += coordinates[i][0] * coordinates[i + 1][1] - coordinates[i + 1][0] * coordinates[i][1];
  }
  return Math.abs(area) / 2;
};

export const initializeAIAnalysis = async (map, onUpdate) => {
  if (!map) {
    console.error('Map not initialized');
    return;
  }
  
  console.log('Initializing AI analysis...');
  
  try {
    const censusData = await analyzeCensusData();
    console.log('Census data loaded:', censusData ? 'yes' : 'no');
    
    const navigator = new AINavigator({
      map: map,
      censusData,
      onUpdate: (newSource) => {
        console.log('Updating map source...');
        if (map.getSource('buildings')) {
          map.getSource('buildings').setData(newSource);
        }
      }
    });
    
    return navigator;
  } catch (error) {
    console.error('Error initializing AI:', error);
    return null;
  }
};

export const highlightPOIBuildings = (map, poiTypes, color) => {
  const features = map.queryRenderedFeatures({
    layers: ['3d-buildings'],
    filter: ['has', 'height']
  });
  
  const buildingCounts = new Map();
  
  features.forEach(building => {
    const pois = map.queryRenderedFeatures(
      map.project(building.geometry.coordinates[0][0]),
      { layers: ['miami-pois'] }
    );
    
    const relevantPOIs = pois.filter(poi => 
      poiTypes.includes(poi.properties.type.toLowerCase())
    );
    
    if (relevantPOIs.length > 0) {
      buildingCounts.set(building.id, relevantPOIs.length);
      map.setFeatureState(
        { source: 'composite', sourceLayer: 'building', id: building.id },
        { isHighlighted: true }
      );
    }
  });
  
  return { buildings: buildingCounts };
};

export const parseClaudeResponse = (response) => {
  console.log('Raw Claude response:', response);
  try {
    if (response?.content?.[0]?.text) {
      const parsed = JSON.parse(response.content[0].text);
      return {
        mainText: parsed.explanation,
        poiInfo: parsed.poiInfo,
        followUps: parsed.followUpSuggestions
      };
    }
    throw new Error('Unexpected response format');
  } catch (e) {
    console.error("Error parsing response:", e);
    return { 
      mainText: "Could not process the response. Please try again.",
      poiInfo: null,
      followUps: []
    };
  }
};

export const handleQuestion = async (question) => {
  try {
    const response = await askClaude(question);
    return parseClaudeResponse(response);
  } catch (error) {
    console.error('Error handling question:', error);
    return null;
  }
};

export const initializeMap = (container) => {
  return new mapboxgl.Map({
    container,
    style: MAP_CONFIG.style,
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom
  });
};

export const setupMapEventListeners = (map, handlers) => {
  if (!map) return () => {};

  const { onLoad } = handlers;

  // Setup load handler
  map.on('load', () => {
    console.log('🌎 Map loaded - initializing layers');
    onLoad?.();
  });

  // Setup hover handlers only
  map.on('mouseenter', '3d-buildings', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', '3d-buildings', () => {
    map.getCanvas().style.cursor = '';
  });

  // Return cleanup function
  return () => {
    map.off('load', onLoad);
    map.off('mouseenter', '3d-buildings');
    map.off('mouseleave', '3d-buildings');
  };
};

export const initializeMapLayers = (map) => {
  if (!map) return;

  // Add 3D buildings layer
  if (!map.getLayer('3d-buildings')) {
    map.addLayer({
      'id': '3d-buildings',
      'source': 'composite',
      'source-layer': 'building',
      'filter': ['==', 'extrude', 'true'],
      'type': 'fill-extrusion',
      'minzoom': 14,
      'paint': {
        'fill-extrusion-color': [
          'case',
          ['boolean', ['feature-state', 'isHighlighted'], false],
          '#FF4500',
          BUILDING_COLORS.DARK_GRAY
        ],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.8
      }
    });
  }

  // Add POI layer with hover interactions disabled
  if (!map.getLayer('miami-pois')) {
    map.addLayer({
      'id': 'miami-pois',
      'type': 'circle',
      'source': 'composite',
      'source-layer': 'poi_label',
      'paint': {
        'circle-color': '#FF4500',
        'circle-radius': 4,
        'circle-opacity': 0.7
      },
      'filter': ['all',
        ['==', ['get', 'type'], 'Restaurant'],
        ['==', ['get', 'type'], 'Bar']
      ],
      'layout': {
        'text-field': '', // Remove text label
        'text-allow-overlap': false,
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
        'text-ignore-placement': false,
        'text-optional': true
      }
    });
  }
};

// Add this new styled component definition at the top
const POIToggleContainer = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(26, 26, 26, 0.9);
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-size: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1;

  input[type="checkbox"] {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 2px solid #FF4500;
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    
    &:checked {
      background: #FF4500;
      &:after {
        content: "✓";
        color: white;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 12px;
      }
    }
  }

  label {
    cursor: pointer;
    user-select: none;
  }
`;

export const createPOIToggle = (map, container, initialState = true) => {
  const toggleContainer = document.createElement('div');
  const root = createRoot(toggleContainer);
  
  const POIToggle = ({ onChange, checked }) => (
    <POIToggleContainer>
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => {
            const newState = e.target.checked;
            onChange(newState);
            if (map.current) {
              map.current.setLayoutProperty(
                'miami-pois',
                'visibility',
                newState ? 'visible' : 'none'
              );
            }
          }}
        />
        <span>Show POI Markers</span>
      </label>
    </POIToggleContainer>
  );

  let currentState = initialState;
  
  const render = () => {
    root.render(
      <POIToggle 
        onChange={(newState) => {
          currentState = newState;
          render(); // Re-render with new state
        }} 
        checked={currentState} 
      />
    );
  };

  render(); // Initial render
  container.appendChild(toggleContainer);

  return {
    setVisibility: (visible) => {
      currentState = visible;
      render();
    },
    cleanup: () => {
      root.unmount();
      container.removeChild(toggleContainer);
    }
  };
};

export const addGeoIdTags = (map, geoIds, setIsGeoIDVisible) => {
    console.log('🏷️ Starting to add tags for GEOIDs:', geoIds);

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Calculate how many GEOIDs to show (40% of total)
    const numberOfTagsToShow = Math.floor(geoIds.length * 0.4);
    
    // Randomly select GEOIDs to show
    const selectedGeoIds = [...geoIds]
      .sort(() => Math.random() - 0.5)  // Shuffle array
      .slice(0, numberOfTagsToShow);    // Take first 40%

    selectedGeoIds.forEach(geoId => {
        const features = map.querySourceFeatures('pmt-boundaries', {
            filter: ['==', ['get', 'GEOID'], geoId]
        });

        if (features.length && features[0].geometry) {
            const coordinates = features[0].geometry.coordinates[0];
            const center = coordinates.reduce((acc, curr) => {
                return [acc[0] + curr[0], acc[1] + curr[1]];
            }, [0, 0]).map(coord => coord / coordinates.length);

            const el = document.createElement('div');
            el.className = 'geoid-label';
            el.innerHTML = `
                <div style="background: rgba(0,0,0,0.75); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px;">
                    ${geoId.slice(-2)}
                </div>
            `;

            new mapboxgl.Marker({
                element: el,
                anchor: 'center'
            })
                .setLngLat(center)
                .addTo(map);
        }
    });

    console.log('✨ Added GEOID markers:', selectedGeoIds.length);
    
    // Trigger the animation by setting isGeoIDVisible to true
    setIsGeoIDVisible(true);
};

export const setupAnimation = async (map, setIsGeoIDVisible) => {
    // ... existing animation setup code ...

    // Wait for the hatch fill layer to be added
    await new Promise(resolve => {
        if (map.getLayer('hatch-fill')) {
            resolve();
        } else {
            map.once('styledata', () => {
                if (map.getLayer('hatch-fill')) {
                    resolve();
                }
            });
        }
    });

    // Add a small delay to ensure animations are running
    setTimeout(() => {
        addGeoIdTags(map, brickellGEOIDs, setIsGeoIDVisible);
    }, 1000);
};
